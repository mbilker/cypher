import Keybase from 'node-keybase';
import libkb from 'libkeybase';
import request from 'request';

const API = 'https://keybase.io/_/api/1.0';

class KeybaseIntegration {
  constructor() {
    this.keybase = new Keybase();

    this.userLookup = Promise.promisify(this.keybase.user_lookup);

    this.loadPreviousLogin = this.loadPreviousLogin.bind(this);
    this.login = this.login.bind(this);
    this.pubKeyForUsername = this.pubKeyForUsername.bind(this);
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

  fetchAndVerifySigChain(username, uid) {
    let parseAsync = Promise.promisify(libkb.ParsedKeys.parse);
    let replayAsync = Promise.promisify(libkb.SigChain.replay);

    return this.userLookup({
      usernames: [ username ],
      fields: [ 'public_keys' ]
    }).then((result) => {
      let key_bundles = result.them[0].public_keys.all_bundles;
      return [
        result.them[0].public_keys.eldest_kid,
        parseAsync({ key_bundles })
      ];
    }).spread((eldest_kid, [ parsed_keys ]) => {
      console.log(parsed_keys);

      let log = (msg) => console.log(msg);

      return this.sigChainForUid(uid).then(({sigs_blobs: sigs}) => {
        return replayAsync({
          sig_blobs, parsed_keys,
          username, uid,
          eldest_kid,
          log
        });
      }).then((err, res) => {
        console.log(err);
        console.log(res);

        global.$pgpSigchain = res;

        return res;
      });
    });
  }
}

export default KeybaseIntegration;
