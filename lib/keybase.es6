import Keybase from 'node-keybase';

class KeybaseIntegration {
  constructor() {
    this.keybase = new Keybase();

    this.pubKeyForUsername = this.pubKeyForUsername.bind(this);
  }

  login(username, password) {
  }

  pubKeyForUsername(username, cb) {
    return new Promise((resolve, reject) => {
      this.keybase.public_key_for_username(username, (err, res) => {
        if (err) {
          return reject(err);
        }
        resolve(res);
      });
    });
  }
}

export default KeybaseIntegration;
