const stage = require("./stage");
const crypto = require("./crypto");

module.exports.type = {
    INIT: 1,
    META: 2,
    READY: 5,
    DATA: 10,
    RESULT: 30
};

function packMessage(payload) {
    return `${payload.type}:${payload.round}:${payload.counter}:${payload.signature != null ? payload.signature : ""}:${payload.data}`;
}

function unpackMessage(payload) {
    try {
        const parts = payload.split(":", 5);
        return {
            type: Number(parts[0]),
            round: Number(parts[1]),
            counter: Number(parts[2]),
            signature: parts[3].length > 0 ? parts[3] : null,
            data: parts[4]
        };
    } catch (err) {
        throw new Error("invalid packet received");
    }
}

module.exports.pack = (sock, type, data, encrypt = true) => {
    // Generate
    let payload = {
        type: type,
        data: Buffer.from(data, "utf-8").toString("base64"),
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
        payload.signature = crypto.digest(sock.keys.encSign, `${payload.type}:${payload.data}:${payload.round}:${payload.counter}`);
        payload = crypto.encrypt(sock, packMessage(payload));
    } else {
        payload = packMessage(payload);
    }

    return `${payload}\n`;
};

module.exports.unpack = (sock, buf) => {
    // Decrypt
    let payload = null;
    if (sock.stage == stage.INIT) {
        payload = buf;
    } else {
        payload = crypto.decrypt(sock, buf);
    }

    // Parse
    payload = unpackMessage(payload);

    // Verify Digest
    // TODO: Check if `payload.type != this.type.INIT` or `packet.signature != null` should do
    if (payload.type != this.type.INIT) {
        if (!crypto.verifyDigest(sock.keys.decSign, `${payload.type}:${payload.data}:${payload.round}:${payload.counter}`, payload.signature)) {
            throw new Error("invalid packet signature");
        }
    }

    // Check Counter
    if (payload.round != sock.rcounter.round || payload.counter != sock.rcounter.val++) {
        throw new Error("invalid packet receive counter");
    }
    if (sock.rcounter.val == Number.MAX_SAFE_INTEGER) {
        sock.rcounter.round++;
        sock.rcounter.val = 0;
    }

    payload.data = Buffer.from(payload.data, "base64").toString("utf-8");

    return payload;
};
