import Keybase from 'node-keybase';
import request from 'request';

const API = 'https://keybase.io/_/api/1.0';

class KeybaseRemote {
  constructor() {
    this.keybase = new Keybase();

    this.login = Promise.promisify(this.keybase.login.bind(this.keybase));
    this.userLookup = Promise.promisify(this.keybase.user_lookup);
    this.publicKeyForUsername = Promise.promisify(this.keybase.public_key_for_username);

    this.loadPreviousLogin = this.loadPreviousLogin.bind(this);
    this.fetchAndVerifySigChain = this.fetchAndVerifySigChain.bind(this);
  }

  loadPreviousLogin() {
    let { username, uid, csrf_token, session_token } = NylasEnv.config.get('cypher.keybase') || {};

    if (username && uid && csrf_token && session_token) {
      console.log('[PGP] Found Keybase stored login, loading into node-keybase');
      this.keybase.usernameOrEmail = username;
      this.keybase.session = session_token;
      this.keybase.csrf_token = csrf_token;
    } else {
      console.log('[PGP] Previous Keybase login not found');
    }
  }

  sigChainForUid(uid) {
    let queryString = '?uid=' + uid;

    return new Promise((resolve, reject) => {
      request.get({
        url: API + '/sig/get.json' + queryString,
        json: true
      }, (err, res, body) => {
        if (err) {
          return reject(err);
        } else if (body.status.code === 200 && body.status.name === 'OK') {
          return reject(body.status);
        }
        return resolve(body);
      });
    });
  }

  fetchAndVerifySigChain(username, uid) {
    console.warn('Please use `KeybaseStore` with `KeybaseActions` and listen to store for events');
    KeybaseStore._fetchAndVerifySigChain(username, uid);
  }
}

export default KeybaseRemote;
