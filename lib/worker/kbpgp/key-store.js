/** @babel */

import kbpgp from 'kbpgp';

import HKP from './hkp';

const hexkid = (k) => k.toString('hex');

// Adapted from PgpKeyRing in kbpgp
class KeyStore {
  constructor() {
    this._keys = {};
    this._kms = {};

    this._hkp = new HKP();

    this.addKeyManager = this.addKeyManager.bind(this);
    this.fetchRemotePublicKey = this.fetchRemotePublicKey.bind(this);
    this.fetch = this.fetch.bind(this);
    this.findBestKey = this.findBestKey.bind(this);
    this.lookup = this.lookup.bind(this);
    this.lookupKeyManager = this.lookupKeyManager.bind(this);

    global.$pgpKeyStore = this;
  }

  addKeyManager(km) {
    const keys = km.export_pgp_keys_to_keyring();
    for (const k of keys) {
      const kid = hexkid(k.key_material.get_key_id());
      this._keys[kid] = k;
      this._kms[kid] = km;
    }
  }

  fetchRemotePublicKey(keyId) {
    return this._hkp.lookup(keyId).then((armored) => new Promise((resolve, reject) => {
      kbpgp.KeyManager.import_from_armored_pgp({ armored }, (err, km, warn) => {
        if (err) {
          reject(err, km, warn);
        } else {
          resolve(km, warn);
        }
      });
    }));
  }

  fetch(keyIds, ops, cb) {
    let km = null;
    let returnValue = null;

    const hexKeyIds = keyIds.map((keyId) => hexkid(keyId));

    const checkForKey = () => {
      for (let _i = 0, _len = hexKeyIds.length; _i < _len; _i++) {
        const id = hexKeyIds[_i];
        const k = this._keys[id];
        if (k && k.key) {
          if (k.key.can_perform(ops)) {
            returnValue = _i;
            km = this._kms[id];
          }
        }
      }
    };

    checkForKey();

    if (!km) {
      const promises = hexKeyIds.map((k) =>
        this.fetchRemotePublicKey(k).then((kmm) => this.addKeyManager(kmm))
      );

      Promise.all(promises).then(() => {
        checkForKey();

        if (km == null) {
          err = new Error(`key not found: ${JSON.stringify(key_ids)}`);
          cb(err, km, returnValue);
        } else {
          cb(err, km, returnValue);
        }
      }).catch((err) => {
        cb(err, km, returnValue);
      });
    } else {
      cb(err, km, returnValue);
    }
  }

  // Pick the best key to fill the flags asked for by the flags.
  // See C.openpgp.key_flags for ideas of what the flags might be.
  findBestKey({ key_id, flags }, cb) {
    let kid = hexkid(key_id);
    let km = this._kms[kid];

    if (km == null) {
      err = new Error("Could not find key for fingerprint " + kid);
    } else if ((key = km.find_best_pgp_key(flags)) == null) {
      err = new Error("no matching key for flags: " + flags);
    }

    cb(err, key);
  }

  lookup(key_id) {
    return this._keys[hexkid(key_id)];
  }

  lookupKeyManager(key_id) {
    return this._kms[hexkid(key_id)];
  }
}

export default new KeyStore();
