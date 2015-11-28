import Keybase from 'node-keybase';

class KeybaseIntegration {
  constructor() {
    this.keybase = new Keybase();

    this.login = this.login.bind(this);
    this.pubKeyForUsername = this.pubKeyForUsername.bind(this);
  }

  login(username, passphrase) {
    if (!username || !passphrase) {
      throw new Error('No username or no passphrase specified');
    }

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
