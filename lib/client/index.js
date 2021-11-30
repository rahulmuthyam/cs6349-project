const net = require('net');
const cert = require("./cert");
const { md, pki } = require("node-forge");
const keygen = require("../protocol/keygen");
const packet = require("../protocol/packet");
const stage = require("../protocol/stage");
const socket = require("../protocol/socket");
const fileUtil = require("../util/file");
const split = require("split");
const LogHorizon = require('log-horizon');
const TransferSpeed = require('../util/transfer-speed');
const logger = new LogHorizon({
    statusType: "badge"
});

module.exports.connect = function (host, port, mode, file) {
    const client = new net.Socket();

    socket.init(client, "[@c][client]", logger);

    function verifyServer(client, msg) {
        try {
            // 1. Certificate
            const authData = JSON.parse(msg.data);
            if (!cert.verify(authData.cert)) {
                throw new Error("certificate");
            }
            const serverPublicKey = pki.publicKeyFromPem(pki.publicKeyToPem(pki.certificateFromPem(authData.cert).publicKey));

            // 2. Timestamp
            // 2.1 Signature
            const sha256 = md.sha256.create();
            const timestampDigest = sha256.update(`${authData.timestamp}`, "utf8").digest().bytes();

            if (!serverPublicKey.verify(timestampDigest, authData.signature)) {
                throw new Error("signature");
            }
            // 2.2 Validity
            if ((authData.timestamp + 5 * 1000) < Date.now()) {
                throw new Error("timestamp validity");
            }

            // Set Authenticated
            client.timestamp = authData.timestamp;
            client.keys.serverPublic = serverPublicKey;

            return true;
        } catch (err) {
            throw new Error("invalid auth payload: " + err.message);
        }
    }

    // https://stackoverflow.com/questions/25894648/sending-messages-too-quickly-in-nodejs-net?noredirect=1&lq=1
    client.pipe(split()).on('data', async (buf) => {
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

                    // Verify Server
                    if (!verifyServer(client, msg)) {
                        throw new Error("server verification failed");
                    }
                    client.stage = stage.AWAIT_META;
                    client.mode = mode;
                    client.file = {
                        ...file,
                        transferSpeed: new TransferSpeed()
                    };

                    // Generate Session Keys and send the Seed to the Server
                    client.keys = {
                        ...client.keys,
                        ...keygen(false, client.timestamp)
                    };
                    const initData = client.keys.serverPublic.encrypt(JSON.stringify({
                        mode: mode,
                        file: {
                            name: file.name,
                            size: file.size
                        },
                        seed: client.keys.seed,
                        timestamp: client.timestamp,
                    }));

                    client.write(packet.pack(client, packet.type.INIT, initData, false));
                    logger.success(`${client.tag} connection setup complete`);

                    // // Upload
                    // if (mode == 0) {
                    //     await fileUtil.sendFile(client);
                    //     client.write(packet.pack(client, packet.type.RESULT, JSON.stringify({
                    //         status: true,
                    //         name: client.file.name
                    //     })));
                    // }

                    break;

                case packet.type.META:
                    if (client.stage != stage.AWAIT_META) {
                        throw new Error("invalid packet type received");
                    }
                    const data = JSON.parse(msg.data);

                    client.stage = mode == 0 ? stage.UPLOAD : stage.DOWNLOAD;
                    client.file.size = data.size;
                    client.file.processedBytes = 0;

                    if (client.stage == stage.DOWNLOAD) {
                        await fileUtil.saveFile(client);
                        client.write(packet.pack(client, packet.type.READY, JSON.stringify({})));
                    }
                    break;

                case packet.type.READY:
                    if (client.stage != stage.UPLOAD) {
                        throw new Error("invalid packet type received");
                    }

                    await fileUtil.sendFile(client);
                    client.write(packet.pack(client, packet.type.RESULT, JSON.stringify({
                        status: true,
                        name: client.file.name
                    })));
                    break;

                case packet.type.DATA:
                    if (client.stage != stage.DOWNLOAD) {
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
                    client.close("complete", false);
                    break;

                default:
                    throw new Error("invalid message type received");
            }
        } catch (err) {
            logger.error(err);
            client.close(err.message, true);
        }
    });

    client.on('close', function (hadError) {
        // Close Stream
        if (client.file && client.file.stream) {
            try {
                client.file.stream.close();
            } catch (err) {
                // Ignore
            }
        }
        // Delete if download
        if (client.stage == stage.DOWNLOAD && (client.errored || hadError)) {
            try {
                fs.unlinkSync(client.file.path);
            } catch (err) {
                // Ignore
            }
        }

        if (hadError) {
            logger.error(`${client.tag} connection closed`);
        } else {
            logger.warn(`${client.tag} connection closed`);
        }
    });

    return new Promise((resolve, reject) => {
        client.on('error', (err) => {
            client.close(err.message, true);
            // This event is also called an error is encountered during `connect`
            if (reject) {
                reject(err);
                reject = undefined;
            }
        });

        client.connect(port, host, function () {
            logger.success(`${client.tag} connected to ${host}:${port}`);
            resolve(client);
        });
    });
}
