import kbpgp from 'kbpgp';
import os from 'os';
import child_process from 'child_process';

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
    let keyId = secretKey.get_pgp_key_id();
    let keyIdHex = keyId.toString('hex');
    let cachedKey = KeyStore.lookupKeyManager(keyId);
    let isLocked = this._controller.isWaitingForPassphrase(keyIdHex);
    if (cachedKey) {
      log('[InProcessDecrypter] Found cached key for %s', secretKey.get_pgp_key_id().toString('hex'));
      return Promise.resolve(cachedKey);
    } else if (isLocked) {
      return isLocked.promise;
    } else {
      return this._decryptKey(secretKey).then(secretKey => {
        KeyStore.addKeyManager(secretKey);
        return this._controller.completedPassphrasePromise(keyIdHex);
      }, err => {
        this._controller.completedPassphrasePromise(keyIdHex, {err});
        throw err;
      });
    }
  }

  _decryptKey(secretKey) {
    if (!secretKey.is_pgp_locked()) {
      return Promise.resolve(secretKey);
    }

    this._notify('Waiting for passphrase...');

    let keyId = secretKey.get_pgp_key_id().toString('hex');
    let askString = `PGP Key with fingerprint <tt>${keyId}</tt> needs to be decrypted`;
    return this._controller.requestPassphrase(keyId, askString).then(passphrase => {
      return new Promise((resolve, reject) => {
        this._notify('Unlocking secret key...');

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

  run(armored, identifier) {
    let startTime = process.hrtime();

    if ((os.platform() === 'linux' || os.platform() === 'darwin') && !process.env.PATH.includes('/usr/local/bin')) {
      process.env.PATH += ":/usr/local/bin";
    }

    var key = child_process.execSync(`gpg --export-secret-keys -a ${identifier}`);

    return this._importKey(key).then(this._checkCache).then(() => {
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

    this._waitingForPassphrase = {};

    this.decrypt = this.decrypt.bind(this);
    this.isWaitingForPassphrase = this.isWaitingForPassphrase.bind(this);
    this.requestPassphrase = this.requestPassphrase.bind(this);
  }

  // TODO: figure out a way to prompt the user to pick which PGP key to use to
  // decrypt or add a config page to allow them to pick per-email account.
  decrypt({armored, secretKey}, notify) {
    if (armored && armored.type === 'Buffer') {
      armored = new Buffer(armored.data);
    }

    if (secretKey && secretKey.type === 'Buffer') {
      secretKey = new Buffer(secretKey.data);
    }

    return new KbpgpDecryptRoutine(this, notify).run(armored, secretKey);
  }

  isWaitingForPassphrase(keyId) {
    return this._waitingForPassphrase[keyId];
  }

  completedPassphrasePromise(keyId, err) {
    if (!this._waitingForPassphrase[keyId]) {
      throw new Error('No pending promise for that keyId');
    }

    if (err) {
      this._waitingForPassphrase[keyId].reject(err);
      return err;
    }

    this._waitingForPassphrase[keyId].resolve();
  }

  requestPassphrase(keyId, askString) {
    if (this._waitingForPassphrase[keyId]) {
      return this._waitingForPassphrase[keyId].promise;
    }

    this._waitingForPassphrase[keyId] = {};
    this._waitingForPassphrase[keyId].promise = new Promise((resolve, reject) => {
      this._waitingForPassphrase[keyId].resolve = resolve;
      this._waitingForPassphrase[keyId].reject = reject;
    }).then(() => {
      delete this._waitingForPassphrase[keyId];
    }, err => {
      delete this._waitingForPassphrase[keyId];
      throw err;
    });

    return this._eventProcessor.requestPassphrase(askString);
  }
}

export default KbpgpDecryptController;
