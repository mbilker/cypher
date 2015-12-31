import kbpgp from 'kbpgp';

import {log} from '../logger';
import KeyStore from './key-store';

class KbpgpDecryptRoutine {
  constructor(controller) {
    this._controller = controller;

    this._importKey = this._importKey.bind(this);
    this._checkCache = this._checkCache.bind(this);
    this._decryptKey = this._decryptKey.bind(this);
    this.run = this.run.bind(this);
  }

  _importKey(armored) {
    //log(armored);

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
      return this._decryptKey(secretKey);
    }
  }

  _decryptKey(secretKey) {
    return new Promise((resolve, reject) => {
      if (!secretKey.is_pgp_locked()) {
        return resolve(secretKey);
      }

      this._controller.requestPassphrase().then((passphrase) => {
        log('[KbpgpDecryptRoutine] Passphrase: %s', passphrase);
        let startTime = process.hrtime();
        secretKey.unlock_pgp({ passphrase }, (err) => {
          if (err) {
            return reject(err);
          }

          let elapsed = process.hrtime(startTime);
          log(`[KbpgpDecryptRoutine] Unlocked secret key in ${elapsed[0] * 1e3 + elapsed[1] / 1e6}ms`);

          resolve(secretKey);
        });
      });
    }).then((secretKey) => {
      KeyStore.addKeyManager(secretKey);
    });
  }

  run(armored, secretKey) {
    let startTime = process.hrtime();

    return this._importKey(secretKey).then(this._checkCache).then(() => {
      return new Promise((resolve, reject) => {
        log('[KbpgpDecryptRoutine] inside the unbox closure');
        kbpgp.unbox({ keyfetch: KeyStore, armored }, (err, literals) => {
          if (err) {
            reject(err, literals);
          } else {
            let elapsed = process.hrtime(startTime);

            resolve({ literals, elapsed });
          }
        });
      });
    });
  }
}

class KbpgpDecryptController {
  constructor(eventProcessor) {
    this._eventProcessor = eventProcessor;

    this.requestPassphrase = this.requestPassphrase.bind(this);
  }

  decrypt({armored, secretKey}) {
    //if (armored.type === '')
    if (armored && armored.type === 'Buffer') {
      armored = new Buffer(armored.data);
    }

    if (secretKey && secretKey.type === 'Buffer') {
      secretKey = new Buffer(secretKey.data);
    }

    return new KbpgpDecryptRoutine(this).run(armored, secretKey);
  }

  requestPassphrase() {
    return this._eventProcessor.requestPassphrase();
  }
}

export default KbpgpDecryptController;
