const stage = require("./stage");

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
    sock.errored = false;
    sock.close = (msg, err = false) => {
        if (sock.destroyed) {
            return;
        }
        if (err) {
            sock.errored = true;
            console.error(`${sock.tag} ${msg}`);
        }
        sock.destroy();
    };
};