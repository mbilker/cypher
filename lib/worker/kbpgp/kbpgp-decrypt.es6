import kbpgp from 'kbpgp';
import os from 'os';
import child_process from 'child_process';

import EventProcessor from '../event-processor';
import {log} from '../logger';
import KeyStore from './key-store';

const unboxAsync = (options) => {
  return new Promise((resolve, reject) => {
    kbpgp.unbox(options, (err, literals) => {
      if (err) {
        reject(err);
      } else {
        resolve(literals);
      }
    });
  });
}

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
    let isLocked = EventProcessor.isWaitingForPassphrase(keyIdHex);
    if (cachedKey) {
      log('[InProcessDecrypter] Found cached key for %s', secretKey.get_pgp_key_id().toString('hex'));

      return Promise.resolve(cachedKey);
    } else if (isLocked) {
      return isLocked.promise;
    } else {
      return this._decryptKey(secretKey).then(secretKey => {
        KeyStore.addKeyManager(secretKey);

        return EventProcessor.completedPassphrasePromise(keyIdHex);
      }, err => {
        EventProcessor.completedPassphrasePromise(keyIdHex, {err});

        return Promise.reject(err);
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
      return Promise.reject(new Error('Passphrase dialog cancelled'));
    });
  }

  run(armored, identifier) {
    const platform = os.platform();
    const method = 'GPG_DECRYPT';
    const startTime = process.hrtime();

    if (method === 'GPG_DECRYPT' && (platform === 'linux' || platform === 'darwin')) {
      if (!process.env.PATH.includes('/usr/local/bin')) {
        process.env.PATH += ":/usr/local/bin";
      }

      //var key = child_process.execSync(`gpg --export-secret-keys -a ${identifier}`);
      let stdout = [];
      let stderr = [];

      const deferred = Promise.defer();
      const child = child_process.spawn('gpg', ['--decrypt']);
      child.stdout.on('data', (data) => {
        stdout.push(data);
      });
      child.stderr.on('data', (data) => {
        stderr.push(data);
      });
      child.on('close', (code) => {
        // GPG throws code 2 when it cannot verify one-pass signature packet
        // inside armored message
        if (code !== 0 && code !== 2) {
          return deferred.reject(new Error(`GPG decrypt failed with code ${code}`));
        }

        const elapsed = process.hrtime(startTime);
        const output = Buffer.concat(stdout);
        const error = Buffer.concat(stderr);
        const literals = [output];

        log(error.toString('utf8'));

        deferred.resolve({literals, elapsed});
      });
      child.stdin.write(armored);
      child.stdin.end();

      return deferred.promise;
    } else {
      let startDecrypt;

      return this._importKey(key).then(this._checkCache).then(() => {
        this._notify(null);
        startDecrypt = process.hrtime();
      }).then(() => unboxAsync({keyfetch: KeyStore, armored})).then((literals) => {
        const decryptTime = process.hrtime(startDecrypt);
        const elapsed = process.hrtime(startTime);

        this._notify(`Message decrypted in ${decryptTime[0] * 1e3 + decryptTime[1] / 1e6}ms`);

        const ds = literals[0].get_data_signer();
        let km = signedBy = null;
        if (ds) {
          km = ds.get_key_manager();
        }
        if (km) {
          signedBy = km.get_pgp_fingerprint().toString('hex');
          console.log(`Signed by PGP fingerprint: ${signedBy}`);
        }

        return {literals, signedBy, elapsed};
      });
    }
  }
}

// Singleton to manage each decryption session, converts stringified Buffers
// back to Buffers for kbpgp
class KbpgpDecryptController {
  constructor() {
    this.decrypt = this.decrypt.bind(this);
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
}

export default KbpgpDecryptController;
