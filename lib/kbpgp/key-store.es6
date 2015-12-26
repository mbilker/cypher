import kbpgp from '../../kbpgp';

import HKP from './hkp';

let hexkid = (k) => k.toString('hex');

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
    let keys = km.export_pgp_keys_to_keyring();
    for (var i = 0, _len = keys.length; i < _len; i++) {
      let k = keys[i];
      let kid = hexkid(k.key_material.get_key_id());
      this._keys[kid] = k;
      this._kms[kid] = km;
    }
  }

  fetchRemotePublicKey(keyId) {
    return this._hkp.lookup(keyId).then((armored) => {
      return new Promise((resolve, reject) => {
        kbpgp.KeyManager.import_from_armored_pgp({ armored }, (err, km, warn) => {
          if (err) {
            reject(err, km, warn);
          } else {
            resolve(km, warn);
          }
        });
      });
    });
  }

  fetch(key_ids, ops, cb) {
    var ret_i, key_material, err, obj, km, _ref;
    var key_material = err = obj = km = null;

    key_ids = (() => {
      var _results = [];
      for (var _i = 0, _len = key_ids.length; _i < _len; _i++) {
        _results.push(hexkid(key_ids[_i]));
      }
      return _results;
    })();

    let check_for_key = () => {
      for (var _i = 0, _len = key_ids.length; _i < _len; _i++) {
        let id = key_ids[_i];
        let k = this._keys[id];
        if (k != null ? (_ref = k.key) != null ? _ref.can_perform(ops) : void 0 : void 0) {
          ret_i = _i;
          km = this._kms[id];
          break;
        }
      }
    }

    check_for_key();

    if (km == null) {
      let promises = key_ids.map((k) => {
        return this.fetchRemotePublicKey(k).then((kmm, warn) => {
          this.addKeyManager(kmm);
        });
      });

      Promise.all(promises).then(() => {
        check_for_key();

        if (km == null) {
          err = new Error(`key not found: ${JSON.stringify(key_ids)}`);
          cb(err, km, ret_i);
        } else {
          cb(err, km, ret_i);
        }
      }).catch((err) => {
        cb(err, km, ret_i);
      });
    } else {
      cb(err, km, ret_i);
    }
  }

  // Pick the best key to fill the flags asked for by the flags.
  // See C.openpgp.key_flags for ideas of what the flags might be.
  findBestKey({key_id, flags}, cb) {
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
