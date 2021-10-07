const fs = require("fs");
const packet = require("../protocol/packet");

module.exports.saveFile = function (client) {
    return new Promise((resolve, reject) => {
        try {
            client.file.stream = fs.createWriteStream(client.file.path);

            client.file.stream.on("open", () => {
                console.log(`${client.tag} file opened for writing`);
                resolve();
            });

            client.file.stream.on('close', function () {
                console.log(`${client.tag} write file stream complete: ${client.file.path}`);
            });

            client.file.stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
};

module.exports.sendFile = function (client) {
    return new Promise((resolve, reject) => {
        client.file.stream = fs.createReadStream(client.file.path);

        client.file.stream.on("open", () => {
            console.log(`${client.tag} file opened for reading`);
        });

        client.file.stream.on('readable', function () {
            let chunk;
            while (null !== (chunk = client.file.stream.read(4096))) {
                try {
                    client.write(packet.pack(client, packet.type.DATA, chunk.toString("base64")));
                } catch (err) {
                    reject(err);
                    break;
                }
            }
        });

        client.file.stream.on('close', function () {
            console.log(`${client.tag} read file stream complete`);
            resolve();
        });

        client.file.stream.on('error', reject);
    });
};
