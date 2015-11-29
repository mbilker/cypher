import path from 'path';

import openpgp from 'openpgp';

openpgp.initWorker(path.join(__dirname, '..', '..', 'node_modules', 'openpgp', 'dist', 'openpgp.worker.js'));
global.openpgp = openpgp;

class InProcessDecrypter {
  decrypt(text, pgpkey) {
    let passphrase = NylasEnv.config.get("email-pgp.passphrase-b64") || '';

    return new Promise((resolve) => {
      console.log("Reading secret key");
      let key = openpgp.key.readArmored(pgpkey);

      if (key.err && key.err.length) {
        key.err.forEach((a, i) => {
          console.log("Secret key read error [#{i}]:", a)
        });
        throw key.err[0];
      }

      console.log("Read secret key");
      return resolve([text, key.keys[0]]);
    }).spread((text, pgpkey) => {
      console.time("Decrypted secret key")

      // TODO: switch to loading this from user interface
      pgpkey.decrypt(new Buffer(passphrase, 'base64').toString())

      console.timeEnd("Decrypted secret key")

      return [text, pgpkey];
    }).spread((text, pgpkey) => openpgp.decryptMessage(pgpkey, openpgp.message.readArmored(text)))
  }
}

export default InProcessDecrypter;
