const stage = require("./stage");
const crypto = require("./crypto");

module.exports.type = {
    INIT: 1,
    META: 2,
    READY: 5,
    DATA: 10,
    RESULT: 30
};

module.exports.pack = (sock, type, data, encrypt = false) => {
    // Generate
    let payload = {
        type: type,
        data: data,
        round: sock.scounter.round,
        counter: sock.scounter.val++,
        signature: null,
    };
    if (sock.scounter.val == Number.MAX_SAFE_INTEGER) {
        sock.scounter.round++;
        sock.scounter.val = 0;
    }

    // Encrypt
    if (encrypt) {
        payload.signature = crypto.digest(sock.keys.encSign, `${type}:${data}:${payload.round}:${payload.counter}`);
        payload = crypto.encrypt(sock, JSON.stringify(payload));
    } else {
        payload = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
    }

    return `${payload}\n`;
};

module.exports.unpack = (sock, buf) => {
    // console.log(buf + "\n\n\n" + sock.stage);

    // Decrypt
    if (sock.stage == stage.INIT) {
        buf = Buffer.from(buf, "base64").toString("utf-8");
    } else {
        buf = crypto.decrypt(sock, buf);
        // console.log(buf);
    }

    // Parse
    const msg = JSON.parse(buf);

    // Verify Digest
    if (msg.signature != null) {
        if (!crypto.verifyDigest(sock.keys.decSign, `${msg.type}:${msg.data}:${msg.round}:${msg.counter}`, msg.signature)) {
            throw new Error("invalid packet signature");
        }
    }

    // Check Counter
    if (msg.round != sock.rcounter.round || msg.counter != sock.rcounter.val++) {
        throw new Error("invalid packet receive counter");
    }
    if (sock.rcounter.val == Number.MAX_SAFE_INTEGER) {
        sock.rcounter.round++;
        sock.rcounter.val = 0;
    }

    return msg;
};
