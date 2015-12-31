import kbpgp from 'kbpgp';

import KeyStore from './key-store';

class KbpgpDecryptRoutine {
  constructor(controller) {
    this._controller = controller;

    this.checkCache = this.checkCache.bind(this);
    this.decryptKey = this.decryptKey.bind(this);
    this.decryptRoutine = this.decryptRoutine.bind(this);
  }

  importKey(armored) {
    return new Promise((resolve, reject) => {
      kbpgp.KeyManager.import_from_armored_pgp({
        armored
      }, (err, secretKey) => {
        if (err) {
          reject(err, secretKey);
        } else {
          resolve(secretKey);
        }
      });
    });
  }

  checkCache(secretKey) {
    let cachedKey = KeyStore.lookupKeyManager(secretKey.get_pgp_key_id());
    if (cachedKey) {
      console.log('[InProcessDecrypter] Found cached key %O', cachedKey);
      return Promise.resolve(cachedKey);
    } else {
      return this.decryptKey(secretKey);
    }
  }

  decryptKey(secretKey) {
    return new Promise((resolve, reject) => {
      if (!secretKey.is_pgp_locked()) {
        return resolve(secretKey);
      }

      this._controller.requestPassphrase().then((passphrase) => {
        let startTime = process.hrtime();
        secretKey.unlock_pgp({
          passphrase: new Buffer(passphrase, 'base64').toString()
        }, (err) => {
          if (err) {
            return reject(err);
          }

          let elapsed = process.hrtime(startTime);
          //console.log(`[InProcessDecrypter] %cUnlocked secret key in ${elapsed[0] * 1e3 + elapsed[1] / 1e6}ms`, "color:red");

          resolve(secretKey);
        });
      });
    }).then((secretKey) => {
      KeyStore.addKeyManager(secretKey);
    });
  }

  decryptRoutine() {
    let startTime = process.hrtime();

    return new Promise((resolve, reject) => {
      kbpgp.unbox({
        keyfetch: KeyStore,
        armored: encryptedMessage
      }, (err, literals) => {
        if (err) {
          reject(err, literals);
        } else {
          let elapsed = process.hrtime(startTime);

          resolve({ literals, elapsed });
        }
      });
    });
  }
}

class KbpgpDecryptController {
  constructor(eventProcessor) {
    this._eventProcessor = eventProcessor;

    this.requestPassphrase = this.requestPassphrase.bind(this);
  }

  requestPassphrase() {
    return this._eventProcessor.requestPassphrase();
  }
}

export default new KbpgpDecryptController();
