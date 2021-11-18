const os = require("os");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { md, pki } = require("node-forge");
const packet = require("../protocol/packet");
const keygen = require("../protocol/keygen");
const stage = require("../protocol/stage");
const socket = require("../protocol/socket");
const fileUtil = require("../util/file");
const split = require("split");
const LogHorizon = require('log-horizon');
const TransferSpeed = require("../util/transfer-speed");
const logger = new LogHorizon({
    statusType: "badge"
});

const serverCert = fs.readFileSync(path.join(__dirname, "../../cert/server-cert.pem"), {
    encoding: "utf-8"
});
const serverKeyPem = fs.readFileSync(path.join(__dirname, "../../cert/server-key.pem"), {
    encoding: "utf-8"
});
const serverPrivateKey = pki.privateKeyFromPem(serverKeyPem);

module.exports.listen = (port) => {
    const server = net.createServer();

    function sendVerification(client) {
        client.timestamp = Date.now();

        const sha256 = md.sha256.create();
        sha256.update(`${client.timestamp}`, "utf8");
        const signature = serverPrivateKey.sign(sha256);

        const payload = packet.pack(client, packet.type.INIT, JSON.stringify({
            cert: serverCert,
            timestamp: client.timestamp,
            signature: signature,
        }), false);

        client.write(Buffer.from(payload, "utf-8"));
    }

    async function processClientData(client, msg) {
        try {
            const data = JSON.parse(serverPrivateKey.decrypt(msg.data));
            if (client.timestamp != data.timestamp) {
                throw new Error("invalid timestamp");
            }

            client.stage = data.mode == 0 ? stage.UPLOAD : stage.DOWNLOAD;
            client.keys = keygen(true, client.timestamp, data.seed);
            client.mode = data.mode;
            client.file = {
                ...data.file,
                processedBytes: 0,
                path: path.join(os.tmpdir(), data.file.name),
                transferSpeed: new TransferSpeed()
            };

            // Upload
            if (client.stage == stage.UPLOAD) {
                await fileUtil.saveFile(client);
                client.write(packet.pack(client, packet.type.META, "{}"));
                client.write(packet.pack(client, packet.type.READY, "{}"));
            }
            // Download
            else if (client.stage == stage.DOWNLOAD) {
                const fileInfo = fs.statSync(client.file.path);
                const file = {
                    exists: fileInfo != null && fileInfo.isFile(),
                    name: client.file.name,
                    size: fileInfo.isFile() ? fileInfo.size : 0,
                };
                if (!file.exists) {
                    throw new Error(`file with name "${file.name}" not found`);
                }
                client.file.size = file.size;
                client.write(packet.pack(client, packet.type.META, JSON.stringify(file)));
            }
            // Invalid
            else {
                throw new Error("invalid process mode sent by client");
            }

            return true;
        } catch (err) {
            logger.error(`${client.tag} ${err.message}`);
            return false;
        }
    }

    server.on('connection', (client) => {
        socket.init(client, `[client][${client.remoteAddress}:${client.remotePort}]`, logger);

        sendVerification(client);

        client.on('error', (err) => {
            client.close(err.message, true);
        });

        // https://stackoverflow.com/questions/25894648/sending-messages-too-quickly-in-nodejs-net?noredirect=1&lq=1
        client.pipe(split()).on("data", async (buf) => {
            if (buf.length == 0) {
                return;
            }
            try {
                const msg = packet.unpack(client, buf);
                switch (msg.type) {
                    case packet.type.INIT:
                        if (client.stage != stage.INIT) {
                            throw new Error("invalid packet type received");
                        }

                        if (!await processClientData(client, msg)) {
                            throw new Error("error processing client data");
                        }
                        logger.success(`${client.tag} connection setup complete`);
                        break;

                    case packet.type.READY:
                        if (client.stage != stage.DOWNLOAD) {
                            throw new Error("invalid packet type received");
                        }

                        await fileUtil.sendFile(client);
                        client.write(packet.pack(client, packet.type.RESULT, JSON.stringify({
                            status: true,
                            name: client.file.name,
                            size: client.file.size,
                        })));
                        break;

                    case packet.type.DATA:
                        if (client.stage != stage.UPLOAD) {
                            throw new Error("invalid packet type received");
                        }

                        const buf = Buffer.from(msg.data, "base64");
                        client.file.stream.write(buf);
                        client.file.processedBytes += buf.length;
                        client.file.transferSpeed.update(client.file.processedBytes);
                        client.showProgress();

                        if (client.file.processedBytes == client.file.size) {
                            client.file.stream.end();
                            client.write(packet.pack(client, packet.type.RESULT, JSON.stringify({
                                status: true,
                                name: client.file.name
                            })));
                        }
                        break;

                    case packet.type.RESULT:
                        if (client.file.processedBytes != client.file.size) {
                            throw new Error("invalid packet type received: file transfer incomplete");
                        }

                        logger.success(`${client.tag} transfer complete`);
                        break;

                    default:
                        throw new Error("invalid message type received");
                }
            } catch (err) {
                client.close(err.message, true);
            }
        });

        client.on("close", (hadError) => {
            // Close Stream
            if (client.file && client.file.stream) {
                try {
                    client.file.stream.close();
                } catch (err) {
                    // Ignore
                }
            }
            // Delete if upload
            if (client.stage == stage.UPLOAD && (client.errored || hadError)) {
                try {
                    fs.unlinkSync(client.file.path);
                } catch (err) {
                    // Ignore
                }
            }

            if (hadError) {
                logger.error(`${client.tag} disconnected`);
            } else {
                logger.warn(`${client.tag} disconnected`);
            }
        });

        logger.success(`${client.tag} connected`);
    });

    const listen = () => {
        server.listen(port, () => {
            logger.success(`[server] listening on port ${port}`);
        });
    };

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            logger.error('[server] listen address in use, retrying...');
            setTimeout(() => {
                server.close();
                listen();
            }, 2000);
        } else {
            logger.error(`[server] error occurred ${e.message}`);
            server.close();
        }
    });

    listen();
};