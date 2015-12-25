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

    return importFromArmoredPGP({
      armored: pgpkey
    }).then(([secretKey, warnings]) => {
      console.log(secretKey.get_pgp_fingerprint());
      let cachedKey = KeyStore.lookupKeyManager(secretKey.get_pgp_key_id());
      console.log(cachedKey);
      if (!cachedKey) {
        return this.decryptKey(secretKey);
      }
    }).then(() => {
      return unbox({
        keyfetch: KeyStore,
        armored: text
      });
    }).then(([literals]) => {
      console.log(literals);

      return literals[0].toString();
    });
  }

  decryptKey(secretKey) {
    let passphrase = NylasEnv.config.get("email-pgp.passphrase-b64") || '';

    return new Promise((resolve) => {
      console.log(secretKey);
      if (secretKey.is_pgp_locked()) {
        let startTime = process.hrtime();
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
      } else {
        resolve(secretKey);
      }
    }).then((secretKey) => {
      console.log('secret key unlocked');

      KeyStore.addKeyManager(secretKey);
    });
  }
}

export default InProcessDecrypter;
