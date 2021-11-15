const stage = require("./stage");
const LogHorizon = require('log-horizon');
const logger = new LogHorizon({
    statusType: "badge"
});

module.exports.init = function (sock, tag) {
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