import libkb from 'libkeybase';
import NylasStore from 'nylas-store';

import KeybaseActions from './keybase-actions';
import KeybaseRemote from '../keybase-integration';

class KeybaseStore extends NylasStore {
  constructor() {
    super();

    this.keybaseRemote = new KeybaseRemote();
    this.keybaseRemote.loadPreviousLogin();

    this._cachedPrimarySigChain = null;

    this.getPrimarySigChain = this.getPrimarySigChain.bind(this);
    this._login = this._login.bind(this);
    this._fetchAndVerifySigChain = this._fetchAndVerifySigChain.bind(this);
    this._loadSavedCredentials = this._loadSavedCredentials.bind(this);

    this.listenTo(KeybaseActions.login, this._login);
    this.listenTo(KeybaseActions.fetchAndVerifySigChain, this._fetchAndVerifySigChain);

    this._loadSavedCredentials();
  }

  // Helper methods

  // SigChain for the stored login
  getPrimarySigChain() {
    return this._cachedPrimarySigChain;
  }

  // Action Trigges

  _login(username, passphrase) {
    this.keybaseRemote.login(username, passphrase).then((res) => {
      console.log(res);

      let { status: { name } } = res;

      if (name === 'BAD_LOGIN_PASSWORD') {
        console.log('[PGP] Keybase login error: Bad Passphrase');
      } else if (name === 'BAD_LOGIN_USER_NOT_FOUND') {
        console.log('[PGP] Keybase login error: Bad Username or Email');
      } else {
        NylasEnv.config.set('email-pgp.keybase.username', username);
        NylasEnv.config.set('email-pgp.keybase.uid', res.uid);
        NylasEnv.config.set('email-pgp.keybase.csrf_token', res.csrf_token);
        NylasEnv.config.set('email-pgp.keybase.session_token', res.session);

        this._loadSavedCredentials();
      }

      this.trigger({ type: 'LOGIN', username, res });
    });
  }

  _fetchAndVerifySigChain(username, uid) {
    let parseAsync = Promise.promisify(libkb.ParsedKeys.parse);
    let replayAsync = Promise.promisify(libkb.SigChain.replay);

    return this.keybaseRemote.userLookup({
      usernames: [ username ],
      fields: [ 'public_keys' ]
    }).then((result) => {
      let key_bundles = result.them[0].public_keys.all_bundles;
      return [
        result.them[0].public_keys.eldest_kid,
        parseAsync({ key_bundles })
      ];
    }).spread((eldest_kid, [ parsed_keys ]) => {
      let log = (msg) => console.log(msg);

      return this.keybaseRemote.sigChainForUid(uid).then(({ sigs: sig_blobs }) => {
        return replayAsync({
          sig_blobs, parsed_keys,
          username, uid,
          eldest_kid,
          log
        });
      }).then((res) => {
        if (username === this.username & uid === this.uid) {
          global.$pgpSigchain = res;
          this._cachedPrimarySigChain = res;
        }

        this.trigger({ username, uid, res });
        return res;
      });
    });
  }

  // Private methods

  _loadSavedCredentials() {
    let { username, uid, csrf_token, session_token } = NylasEnv.config.get('email-pgp.keybase') || {};
    this.username = username;
    this.uid = uid;
    this.csrf_token = csrf_token;
    this.session_token = session_token;

    if (this.username && this.uid) {
      this._fetchAndVerifySigChain(this.username, this.uid);
    }
  }
}

export default new KeybaseStore();
