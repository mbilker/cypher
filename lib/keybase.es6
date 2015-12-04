import Keybase from 'node-keybase';
import msgpack from 'msgpack-lite';
import naclb from 'naclb';
import tweetnacl from 'tweetnacl';

const API = 'https://keybase.io/_/api/1.0';

class KeybaseIntegration {
  constructor() {
    this.keybase = new Keybase();

    this.loadPreviousLogin = this.loadPreviousLogin.bind(this);
    this.login = this.login.bind(this);
    this.pubKeyForUsername = this.pubKeyForUsername.bind(this);
    this.verifyPGPSignature = this.verifyPGPSignature.bind(this);
    this.fetchAndVerifySigChain = this.fetchAndVerifySigChain.bind(this);
  }

  loadPreviousLogin() {
    let { username, uid, csrf_token, session_token } = NylasEnv.config.get('email-pgp.keybase');

    if (username && uid && csrf_token && session_token) {
      console.log('[PGP] Found Keybase stored login, loading into node-keybase');
      this.keybase.usernameOrEmail = username;
      this.keybase.session = session_token;
      this.keybase.csrf_token = csrf_token;
    } else {
      console.log('[PGP] Previous Keybase login not found');
    }
  }

  login(username, passphrase) {
    return new Promise((resolve, reject) => {
      this.keybase.login(username, passphrase, (err, res) => {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
    });
  }

  sigChainForUsername(uid) {
    let queryString = '?uid=' + uid;

    return new Promise((resolve, reject) => {
      request.get({
        url: API + '/sig/get.json' + queryString,
        json: true
    }, (err, res, body) => {
        if (err) {
          return reject(err);
        } else if (body.status.code === 0 && body.status.name === 'OK') {
          return reject(body.status);
        }
        return resolve(body);
      });
    });
  }

  pubKeyForUsername(username) {
    return new Promise((resolve, reject) => {
      this.keybase.public_key_for_username(username, (err, res) => {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
    });
  }

  verifyPGPSignature(pubKey, sig) {
    let message = openpgp.message.readArmored(sig.sig);
    let result = message.verify(pubKey.keys);
    if (result.every((a) => a.valid)) {
      console.log(`Signature for ${sig.payload_hash} is valid for personal PGP public key`);
    } else {
      console.log(`Signature for ${sig.payload_hash} is %c valid`, 'color:red;content:"NOT";');
      console.log(result);
    }

    return result;
  }

  fetchAndVerifySigChain(username, uid) {
    return Promise.all([
      // ok
      //this.keybase.pubKeyForUsername(username),
      //this.keybase.sigChainForUsername(uid)
      require('fs').readFileAsync('/home/mbilker/key.asc', 'utf8'),
      require('fs').readFileAsync('/home/mbilker/json', 'utf8').then((a) => JSON.parse(a))
    ]).spread((pubKey, res) => {
      pubKey = openpgp.key.readArmored(pubKey);

      if (pubKey.err && pubKey.err.length) {
        pubKey.err.forEach((a, i) => {
          console.log(`Public key read error [${i}]:`, a);
        });
        throw pubKey.err[0];
      }

      res.sigs.forEach((sig) => {
        let kid = new Buffer(sig.kid, 'hex');
        if (kid[0] === 0x01 &&
            kid[1] === 0x01) { // PGP key
          try {
            this.verifyPGPSignature(pubKey, sig);
          } catch (e) {
            console.log(`Unable to verify signature for ${sig.payload_hash}`);
            console.log(sig);
            console.log(e);
          }
        } else if (kid[0] === 0x01 &&
                   kid[1] === 0x20) {  // EdDSA key
          console.log(`Cannot fully verify EdDSA signature for ${sig.payload_hash}`);

          let decode = msgpack.decode(new Buffer(sig.sig, 'base64'));
          let keybytes = decode.body.key.slice(2);
          let { sig, payload } = decode.body;

          let attached_sig_bytes = Buffer.concat([ decode.body.sig, decode.body.payload ]);
          let unboxed = new Buffer(sig.payload_json.length);
          let verifykey = naclb(unboxed, attached_sig_bytes, keybytes);
          console.log(verifykey);
          console.log(unboxed.toString('utf8') === sig.payload_json);
        }
      });
    });
  }
}

export default KeybaseIntegration;
