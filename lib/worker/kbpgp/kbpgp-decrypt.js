/** @babel */

import kbpgp from 'kbpgp';
import childProcess from 'child_process';

import EventProcessor from '../event-processor';
import { log } from '../logger';
import KeyStore from './key-store';

const unboxAsync = (options) => new Promise((resolve, reject) => {
  kbpgp.unbox(options, (err, literals) => {
    if (err) {
      reject(err);
    } else {
      resolve(literals);
    }
  });
});

class KbpgpDecryptRoutine {
  constructor(controller, notify) {
    this._controller = controller;
    this.notify = notify;

    this._importKey = this._importKey.bind(this);
    this._checkCache = this._checkCache.bind(this);
    this._decryptKey = this._decryptKey.bind(this);
    this.run = this.run.bind(this);
  }

  _importKey(armored) {
    return new Promise((resolve, reject) => {
      kbpgp.KeyManager.import_from_armored_pgp({ armored }, (err, secretKey) => {
        if (err) {
          reject(err, secretKey);
        } else {
          resolve(secretKey);
        }
      });
    });
  }

  _checkCache(secretKey) {
    const keyId = secretKey.get_pgp_key_id();
    const keyIdHex = keyId.toString('hex');
    const cachedKey = KeyStore.lookupKeyManager(keyId);
    const isLocked = EventProcessor.isWaitingForPassphrase(keyIdHex);

    if (cachedKey) {
      log('[InProcessDecrypter] Found cached key for %s', keyIdHex);

      return Promise.resolve(cachedKey);
    } else if (isLocked) {
      return isLocked.promise;
    }

    const isKeyLocked = secretKey.is_pgp_locked();

    return this._decryptKey(secretKey).then(decryptedKey => {
      KeyStore.addKeyManager(decryptedKey);
      if (isKeyLocked) {
        EventProcessor.completedPassphrasePromise(keyIdHex);
      }
    }, err => {
      if (isKeyLocked) {
        EventProcessor.completedPassphrasePromise(keyIdHex, { err });
      }
      return Promise.reject(err);
    });
  }

  _decryptKey(secretKey) {
    if (!secretKey.is_pgp_locked()) {
      return Promise.resolve(secretKey);
    }

    this.notify('Waiting for passphrase...');

    const keyId = secretKey.get_pgp_key_id().toString('hex');
    const askString = `PGP Key with fingerprint <tt>${keyId}</tt> needs to be decrypted`;
    return this._controller.requestPassphrase(keyId, askString).then(passphrase =>
      new Promise((resolve, reject) => {
        this.notify('Unlocking secret key...');

        const startTime = process.hrtime();
        secretKey.unlock_pgp({ passphrase }, (err) => {
          if (err) {
            return reject(err);
          }

          const elapsed = process.hrtime(startTime);
          const msg = `Secret key unlocked secret key in ${elapsed[0] * 1e3 + elapsed[1] / 1e6}ms`;

          this.notify(msg);
          log('[KbpgpDecryptRoutine] %s', msg);

          resolve(secretKey);
        });
      })
    , () =>
      // Since the first argument is undefined, the rejected promise does not
      // propagate to the `catch` receiver in `EventProcessor`. Create an Error
      // here to ensure the error is delivered to `EventProcessor`
      Promise.reject(new Error('Passphrase dialog cancelled'))
    );
  }

  run(armored, identifier) {
    const platform = process.platform;
    const method = 'GPG_DECRYPT';
    const startTime = process.hrtime();

    if (method === 'GPG_DECRYPT' && (platform === 'linux' || platform === 'darwin')) {
      this.notify('Waiting for GPG...');

      // var key = childProcess.execSync(`gpg --export-secret-keys -a ${identifier}`);
      const stdout = [];
      const stderr = [];

      const deferred = Promise.defer();
      const child = childProcess.spawn('gpg', ['--decrypt']);
      child.stdout.on('data', (data) => stdout.push(data));
      child.stderr.on('data', (data) => stderr.push(data));
      child.on('close', (code) => {
        // GPG throws code 2 when it cannot verify one-pass signature packet
        // inside armored message
        if (code !== 0 && code !== 2) {
          return deferred.reject(new Error(`GPG decrypt failed with code ${code}`));
        }

        this.notify(null);

        const elapsed = process.hrtime(startTime);
        const output = Buffer.concat(stdout);
        const error = Buffer.concat(stderr);
        const literals = [output];

        log(error.toString('utf8'));

        deferred.resolve({ literals, elapsed });
      });
      child.stdin.write(armored);
      child.stdin.end();

      return deferred.promise;
    }

    let startDecrypt = null;

    return this._importKey(identifier)
      .then(this._checkCache)
      .then(() => {
        this.notify(null);
        startDecrypt = process.hrtime();
      })
      .then(() => unboxAsync({ keyfetch: KeyStore, armored }))
      .then((literals) => {
        const decryptTime = process.hrtime(startDecrypt);
        const elapsed = process.hrtime(startTime);

        this.notify(`Message decrypted in ${decryptTime[0] * 1e3 + decryptTime[1] / 1e6}ms`);

        const ds = literals[0].get_data_signer();
        let km = null;
        let signedBy = null;
        if (ds) {
          km = ds.get_key_manager();
        }
        if (km) {
          signedBy = km.get_pgp_fingerprint().toString('hex');
          log(`Signed by PGP fingerprint: ${signedBy}`);
        }

        return { literals, signedBy, elapsed };
      });
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
  decrypt({ armored, secretKey }, notify) {
    let bufferData = armored;
    if (armored && armored.type === 'Buffer') {
      bufferData = new Buffer(armored.data);
    }

    let keyToUse = secretKey;
    if (secretKey && secretKey.type === 'Buffer') {
      keyToUse = new Buffer(secretKey.data);
    }

    return new KbpgpDecryptRoutine(this, notify).run(bufferData, keyToUse);
  }
}

export default KbpgpDecryptController;
