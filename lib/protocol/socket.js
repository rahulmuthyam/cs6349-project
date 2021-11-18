const stage = require("./stage");

module.exports.init = function (sock, tag, logger) {
    let lastProgressTime = 0;

    sock.setEncoding('utf8');
    sock.tag = tag;
    sock.rcounter = {
        round: 0,
        val: 0
    };
    sock.scounter = {
        round: 0,
        val: 0
    };
    sock.stage = stage.INIT;
    sock.timestamp = -1;
    sock.keys = {
        serverPublic: null,
        enc: null,
        encSign: null,
        dec: null,
        decSign: null,
    };
    sock.keyBuf = {
        enc: null,
        encIv: null,
        dec: null,
        decIv: null,
    };
    sock.errored = false;
    sock.showProgress = () => {
        const now = Date.now();
        if ((now - lastProgressTime >= 250) && sock.file.processedBytes < sock.file.size) {
            logger.progress(`${sock.tag} transfer progress: ${((100 * sock.file.processedBytes) / sock.file.size).toFixed(1)}% at ${sock.file.transferSpeed.getSpeed()}`);
            lastProgressTime = now;
        }
    };
    sock.close = (msg, err = false) => {
        if (sock.destroyed) {
            return;
        }
        if (err) {
            sock.errored = true;
            logger.error(`${sock.tag} ${msg}`);
        }
        sock.destroy();
    };
};