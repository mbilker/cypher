import path from 'path';

import openpgp from 'openpgp';

class InProcessDecrypter {
  decrypt(text, pgpkey) {
    return new Promise((resolve) => {
      console.log("Reading secret key");
      let key = openpgp.key.readArmored(pgpkey);

      if (key.err && key.err.length) {
        key.err.forEach((a, i) => {
          console.log(`Secret key read error [${i}]:`, a);
        });
        throw key.err[0];
      }

      console.log("Read secret key");
      return resolve([text, key.keys[0]]);
    }).spread((text, pgpkey) => {
      console.time("Decrypted secret key");

      // TODO: get key fingerprint from openpgpjs
      let msg = `PGP Key with fingerprint <tt>TODO</tt> needs to be decrypted`;
      return smalltalk.passphrase('PGP Passphrase', msg || '').then((passphrase) => {
        pgpkey.decrypt(passphrase);

        console.timeEnd("Decrypted secret key");

        return [text, pgpkey];
      });
    }).spread((text, pgpkey) => openpgp.decryptMessage(pgpkey, openpgp.message.readArmored(text)))
  }
}

export default InProcessDecrypter;
