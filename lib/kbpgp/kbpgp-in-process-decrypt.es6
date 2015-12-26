import kbpgp from '../../kbpgp';

import KeyStore from '../kbpgp/key-store';

class InProcessDecrypter {
  constructor() {
    this.decrypt = this.decrypt.bind(this);
    this.decryptKey = this.decryptKey.bind(this);
  }

  decrypt(text, pgpkey) {
    let importFromArmoredPGP = Promise.promisify(kbpgp.KeyManager.import_from_armored_pgp);
    let unbox = Promise.promisify(kbpgp.unbox);

    var startTime;

    return importFromArmoredPGP({
      armored: pgpkey
    }).then(([secretKey, warnings]) => {
      let cachedKey = KeyStore.lookupKeyManager(secretKey.get_pgp_key_id());
      if (cachedKey) {
        console.log('[InProcessDecrypter] Found cached key %O', cachedKey);
      } else {
        return this.decryptKey(secretKey);
      }
    }).then(() => {
      startTime = process.hrtime();
      return unbox({
        keyfetch: KeyStore,
        armored: text
      });
    }).then(([literals]) => {
      let elapsed = process.hrtime(startTime);
      console.log(`[InProcessDecrypter] %cDecrypted literals in ${elapsed[0] * 1e3 + elapsed[1] / 1e6}ms`, 'color:red');

      return literals[0].toString();
    });
  }

  decryptKey(secretKey) {
    let passphrase = NylasEnv.config.get("email-pgp.passphrase-b64") || '';

    return new Promise((resolve, reject) => {
      if (secretKey.is_pgp_locked()) {
        let startTime = process.hrtime();
        secretKey.unlock_pgp({
          passphrase: new Buffer(passphrase, 'base64').toString()
        }, (err) => {
          if (err) {
            return reject(err);
          }

          let elapsed = process.hrtime(startTime);
          console.log(`[InProcessDecrypter] %cUnlocked secret key in ${elapsed[0] * 1e3 + elapsed[1] / 1e6}ms`, "color:red");

          resolve(secretKey);
        });
      } else {
        resolve(secretKey);
      }
    }).then((secretKey) => {
      KeyStore.addKeyManager(secretKey);
    });
  }
}

export default InProcessDecrypter;
