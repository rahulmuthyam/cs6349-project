const forge = require("node-forge");

module.exports = (server, timestamp, seed = forge.random.getBytesSync(32)) => {
    let counter = timestamp;

    function nextKey() {
        const md = forge.md.sha256.create();
        md.update(counter++ ^ seed ^ ++counter);
        return md.digest().getBytes(32);
    }

    const keys = [nextKey(), nextKey(), nextKey(), nextKey()];

    return {
        seed: seed,
        timestamp: timestamp,
        enc: server ? keys[0] : keys[2],
        encSign: server ? keys[1] : keys[3],
        dec: server ? keys[2] : keys[0],
        decSign: server ? keys[3] : keys[1],
    };
};