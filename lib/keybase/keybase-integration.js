import Keybase from 'node-keybase';
import request from 'request';

import Logger from '../../utils/Logger';

const API = 'https://keybase.io/_/api/1.0';

class KeybaseRemote {
  constructor() {
    this.loadPreviousLogin = this.loadPreviousLogin.bind(this);
    this.fetchAndVerifySigChain = this.fetchAndVerifySigChain.bind(this);

    this.keybase = new Keybase();

    this.login = Promise.promisify(this.keybase.login.bind(this.keybase));
    this.userLookup = Promise.promisify(this.keybase.user_lookup);
    this.publicKeyForUsername = Promise.promisify(this.keybase.public_key_for_username);

    this.log = Logger.create('KeybaseRemote');
  }

  loadPreviousLogin() {
    const {
      username,
      uid,
      csrf_token: csrfToken,
      session_token: sessionToken,
    } = NylasEnv.config.get('cypher.keybase') || {};

    if (username && uid && csrfToken && sessionToken) {
      this.log.info('Found Keybase stored login, loading into node-keybase');
      this.keybase.usernameOrEmail = username;
      this.keybase.session = sessionToken;
      this.keybase.csrf_token = csrfToken;
    } else {
      this.log.info('Previous Keybase login not found');
    }
  }

  sigChainForUid(uid) {
    const url = `${API}/sig/get.json?uid=${uid}`;

    return new Promise((resolve, reject) => {
      request.get({ url, json: true }, (err, res, body) => {
        if (err) {
          return reject(err);
        } else if (body.status.code === 200 && body.status.name === 'OK') {
          return reject(body.status);
        }
        return resolve(body);
      });
    });
  }
}

export default new KeybaseRemote();
