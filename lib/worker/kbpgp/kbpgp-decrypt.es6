import kbpgp from 'kbpgp';

import {log} from '../logger';
import KeyStore from './key-store';

class KbpgpDecryptRoutine {
  constructor(controller, notify) {
    this._controller = controller;
    this._notify = notify;

    this._importKey = this._importKey.bind(this);
    this._checkCache = this._checkCache.bind(this);
    this._decryptKey = this._decryptKey.bind(this);
    this.run = this.run.bind(this);
  }

  _importKey(armored) {
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

  _checkCache(secretKey) {
    let cachedKey = KeyStore.lookupKeyManager(secretKey.get_pgp_key_id());
    if (cachedKey) {
      log('[InProcessDecrypter] Found cached key for %s', secretKey.get_pgp_key_id().toString('hex'));
      return Promise.resolve(cachedKey);
    } else {
      return this._decryptKey(secretKey).then((secretKey) => {
        KeyStore.addKeyManager(secretKey);
      });
    }
  }

  _decryptKey(secretKey) {
    if (!secretKey.is_pgp_locked()) {
      return Promise.resolve(secretKey);
    }

    this._notify('Waiting for passphrase...');

    let askString = `PGP Key with fingerprint <tt>${secretKey.get_pgp_key_id().toString('hex')}</tt> needs to be decrypted`;
    return this._controller.requestPassphrase(askString).then((passphrase) => {
      this._notify('Unlocking secret key...');

      return new Promise((resolve, reject) => {
        let startTime = process.hrtime();
        secretKey.unlock_pgp({ passphrase }, (err) => {
          if (err) {
            return reject(err);
          }

          let elapsed = process.hrtime(startTime);
          let msg = `Secret key unlocked secret key in ${elapsed[0] * 1e3 + elapsed[1] / 1e6}ms`;

          this._notify(msg);
          log('[KbpgpDecryptRoutine] %s', msg);

          resolve(secretKey);
        });
      });
    }, () => {
      // Since the first argument is undefined, the rejected promise does not
      // propagate to the `catch` receiver in `EventProcessor`. Create an Error
      // here to ensure the error is delivered to `EventProcessor`
      throw new Error('Passphrase dialog cancelled');
    });
  }

  run(armored, secretKey) {
    let startTime = process.hrtime();

    return this._importKey(secretKey).then(this._checkCache).then(() => {
      return new Promise((resolve, reject) => {
        log('[KbpgpDecryptRoutine] inside the unbox closure');
        this._notify(null);

        let startDecrypt = process.hrtime();
        kbpgp.unbox({ keyfetch: KeyStore, armored }, (err, literals) => {
          if (err) {
            reject(err, literals);
          } else {
            let decryptTime = process.hrtime(startDecrypt);
            let elapsed = process.hrtime(startTime);

            this._notify(`Message decrypted in ${decryptTime[0] * 1e3 + decryptTime[1] / 1e6}ms`);
            resolve({ literals, elapsed });
          }
        });
      });
    });
  }
}

// Singleton to manage each decryption session, converts stringified Buffers
// back to Buffers for kbpgp
class KbpgpDecryptController {
  constructor(eventProcessor) {
    this._eventProcessor = eventProcessor;

    this.requestPassphrase = this.requestPassphrase.bind(this);
  }

  decrypt({armored, secretKey}, notify) {
    if (armored && armored.type === 'Buffer') {
      armored = new Buffer(armored.data);
    }

    if (secretKey && secretKey.type === 'Buffer') {
      secretKey = new Buffer(secretKey.data);
    }

    return new KbpgpDecryptRoutine(this, notify).run(armored, secretKey);
  }

  requestPassphrase(askString) {
    return this._eventProcessor.requestPassphrase(askString);
  }
}

export default KbpgpDecryptController;
