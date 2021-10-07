const fs = require('fs');
const path = require("path");
const { pki } = require('node-forge');

const caCert = pki.certificateFromPem(fs.readFileSync(path.join(__dirname, '../../cert/ca.pem'), "utf-8"));

module.exports.verify = (serverCert) => {
    serverCert = pki.certificateFromPem(serverCert);
    try {
        return caCert.verify(serverCert);
    } catch (err) {
        return false;
    }
};
