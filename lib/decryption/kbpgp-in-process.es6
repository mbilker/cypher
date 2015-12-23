import kbpgp from '../../kbpgp';

import KeyStore from '../kbpgp/key-store';

let ring = KeyStore;

class InProcessDecrypter {
  decrypt(text, pgpkey) {
    let passphrase = NylasEnv.config.get("email-pgp.passphrase-b64") || '';

    return Promise.promisify(kbpgp.KeyManager.import_from_armored_pgp)({
      armored: pgpkey
    }).then(([secretKey, warnings]) => {
      console.log(secretKey);
      console.log(warnings);
      if (secretKey.is_pgp_locked()) {
        let startTime = process.hrtime();
        return new Promise((resolve, reject) => {
          secretKey.unlock_pgp({
            passphrase: new Buffer(passphrase, 'base64').toString()
          }, (err) => {
            if (err) {
              return reject(err);
            }

            let elapsed = process.hrtime(startTime);
            console.log(elapsed);

            resolve(secretKey);
          });
        });
      } else {
        return secretKey;
      }
    }).then((secretKey) => {
      console.log('secret key unlocked');

      KeyStore.addKeyManager(secretKey);
    }).then(() => {
      return Promise.promisify(kbpgp.unbox)({
        keyfetch: KeyStore,
        armored: text
      });
    }).then((literals) => {
      console.log(literals);

      return literals[0].toString();
    });
  }
}

export default InProcessDecrypter;
