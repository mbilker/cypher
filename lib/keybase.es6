import Keybase from 'node-keybase';

class KeybaseIntegration {
  constructor() {
    this.keybase = new Keybase();

    this.loadPreviousLogin = this.loadPreviousLogin.bind(this);
    this.login = this.login.bind(this);
    this.pubKeyForUsername = this.pubKeyForUsername.bind(this);
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

  pubKeyForUsername(username, cb) {
    return new Promise((resolve, reject) => {
      this.keybase.public_key_for_username(username, (err, res) => {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
    });
  }
}

export default KeybaseIntegration;
