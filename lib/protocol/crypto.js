const { hmac, md } = require("node-forge");

function getNextKey(key, iv) {
    const mdAlgo = md.sha256.create();
    mdAlgo.update(Buffer.concat([key, iv]).toString("ascii"));
    return Buffer.from(mdAlgo.digest().getBytes(32), "ascii");
}

module.exports.encrypt = function (sock, data) {
    let keyBuf = sock.keyBuf.enc || Buffer.from(sock.keys.enc, "ascii");
    const ivBuf = sock.keyBuf.encIv || Buffer.from(sock.keys.encSign, "ascii");
    const dataBuf = Buffer.from(data, "utf-8");
    const cipherBuf = Buffer.alloc(dataBuf.length);

    keyBuf = getNextKey(keyBuf, ivBuf);

    for (let i = 0; i < dataBuf.length; ++i) {
        cipherBuf[i] = dataBuf[i] ^ keyBuf[i % keyBuf.length];
    }

    sock.keyBuf.encIv = keyBuf;
    sock.keyBuf.enc = cipherBuf;

    return cipherBuf.toString("base64");
};

module.exports.decrypt = function (sock, data) {
    let keyBuf = sock.keyBuf.dec || Buffer.from(sock.keys.dec, "ascii");
    const ivBuf = sock.keyBuf.decIv || Buffer.from(sock.keys.decSign, "ascii");
    const dataBuf = Buffer.from(data, "base64");
    const cipherBuf = Buffer.alloc(dataBuf.length);

    keyBuf = getNextKey(keyBuf, ivBuf);

    for (let i = 0; i < dataBuf.length; ++i) {
        cipherBuf[i] = dataBuf[i] ^ keyBuf[i % keyBuf.length];
    }

    sock.keyBuf.decIv = keyBuf;
    sock.keyBuf.dec = dataBuf;

    return cipherBuf.toString("utf-8");
};

module.exports.digest = function (key, data) {
    const hmacAlgo = hmac.create();
    hmacAlgo.start("sha256", key);
    hmacAlgo.update(data);
    return hmacAlgo.digest().toHex();
};

module.exports.verifyDigest = function (key, data, digest) {
    const dataDigest = this.digest(key, data);
    return dataDigest === digest;
};