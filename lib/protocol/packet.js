const stage = require("./stage");

module.exports.type = {
    INIT: 1,
    META: 2,
    DATA: 10,
    RESULT: 30
};

module.exports.pack = (sock, type, data) => {
    let payload = JSON.stringify({
        type: type,
        data: data,
        round: sock.scounter.round,
        counter: sock.scounter.val++,
    });

    if (sock.scounter.val == Number.MAX_SAFE_INTEGER) {
        sock.scounter.round++;
        sock.scounter.val = 0;
    }

    if (sock.stage != stage.INIT) {
        // TODO: Encrypt & Digest Gen
        payload = Buffer.from(payload, "utf-8").toString("base64");
    }

    return `${payload}\n`;
};

module.exports.unpack = (sock, buf) => {
    // Decrypt Payload
    if (sock.stage != stage.INIT) {
        // TODO
        buf = buf;
    }

    // Parse
    // console.error("\n\n" + (buf.toString("utf-8")) + "\n\n")
    const msg = JSON.parse(Buffer.from(buf, "base64").toString("utf-8"));

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
