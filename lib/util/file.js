const fs = require("fs");
const packet = require("../protocol/packet");
const LogHorizon = require('log-horizon');
const logger = new LogHorizon({
    statusType: "badge"
});

module.exports.saveFile = function (client) {
    return new Promise((resolve, reject) => {
        try {
            client.file.stream = fs.createWriteStream(client.file.path);

            client.file.stream.on("open", () => {
                logger.success(`${client.tag} file opened for writing`);
                resolve();
            });

            client.file.stream.on('close', function () {
                logger.warn(`${client.tag} write file stream closed: ${client.file.path}`);
            });

            client.file.stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
};

module.exports.sendFile = function (client) {
    return new Promise(async (resolve, reject) => {
        client.file.stream = fs.createReadStream(client.file.path);
        client.file.processedBytes = 0;
        client.file.size = (await fs.promises.stat(client.file.path)).size;

        client.file.stream.on("open", () => {
            logger.success(`${client.tag} file opened for reading`);
        });

        client.file.stream.on('readable', function () {
            let chunk;
            while (null !== (chunk = client.file.stream.read(4096))) {
                try {
                    client.write(packet.pack(client, packet.type.DATA, chunk.toString("base64")));
                    client.file.processedBytes += chunk.length;
                    logger.progress(`${client.tag} transfer progress: ${((100 * client.file.processedBytes) / client.file.size).toFixed(2)}%`);
                } catch (err) {
                    reject(err);
                    break;
                }
            }
        });

        client.file.stream.on('close', function () {
            logger.warn(`${client.tag} read file stream closed`);
            resolve();
        });

        client.file.stream.on('error', reject);
    });
};
