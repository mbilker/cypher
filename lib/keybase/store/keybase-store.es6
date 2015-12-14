import fs from 'fs';
import path from 'path';

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

    this._configurationDirPath = path.join(NylasEnv.getConfigDirPath(), 'email-pgp');

    this.getPrimarySigChain = this.getPrimarySigChain.bind(this);
    this.getTrackedUsers = this.getTrackedUsers.bind(this);
    this._login = this._login.bind(this);
    this._fetchAndVerifySigChain = this._fetchAndVerifySigChain.bind(this);
    this._checkConfigurationDirectoryExists = this._checkConfigurationDirectoryExists.bind(this);
    this._loadSavedCredentials = this._loadSavedCredentials.bind(this);

    this.listenTo(KeybaseActions.login, this._login);
    this.listenTo(KeybaseActions.fetchAndVerifySigChain, this._fetchAndVerifySigChain);

    this._checkConfigurationDirectoryExists();
    this._loadSavedCredentials();

    global.$pgpKeybaseStore = this;
  }

  // Helper methods

  // SigChain for the stored login
  getPrimarySigChain() {
    return this._cachedPrimarySigChain;
  }

  getPrimaryTrackedUsers() {
    return this.getTrackedUsers(this._cachedPrimarySigChain);
  }

  getTrackedUsers(sigchain) {
    if (!sigchain) {
      throw new Error('No sigchain provided');
    }

    let trackingStatus = sigchain
      .get_links()
      .filter((a) => a.type === 'track' || a.type === 'untrack')
      .reduce((origValue, value) => {
        origValue[value.payload.body[value.type].basics.username] = origValue[value.payload.body[value.type].basics.username] || 0;
        if (value.type === 'track') {
          origValue[value.payload.body[value.type].basics.username] += 1;
        } else if (value.type === 'untrack') {
          origValue[value.payload.body[value.type].basics.username] -= 1;
        }
        return origValue;
      }, {});

    return Object.keys(b).reduce((array, name) => {
      if (b[name] % 2 === 0) {
        array.push(name);
      }
    }, []);
  }

  // Action Trigges

  _login(username, passphrase) {
    this.keybaseRemote.login(username, passphrase).then((res) => {
      console.log(res);

      let promise = Promise.resolve(true);
      let { status: { name } } = res;

      if (name === 'BAD_LOGIN_PASSWORD') {
        console.log('[PGP] Keybase login error: Bad Passphrase');
        promise = Promise.resolve(false);
      } else if (name === 'BAD_LOGIN_USER_NOT_FOUND') {
        console.log('[PGP] Keybase login error: Bad Username or Email');
        promise = Promise.resolve(false);
      } else {
        NylasEnv.config.set('email-pgp.keybase.username', username);
        NylasEnv.config.set('email-pgp.keybase.uid', res.uid);
        NylasEnv.config.set('email-pgp.keybase.csrf_token', res.csrf_token);
        NylasEnv.config.set('email-pgp.keybase.session_token', res.session);

        promise = fs.writeFileAsync(path.join(this._configurationDirPath, ))

        this._loadSavedCredentials();
      }

      this.trigger({ type: 'LOGIN', username, res });

      return promise;
    });
  }

  _fetchAndVerifySigChain(username, uid) {
    let parseAsync = Promise.promisify(libkb.ParsedKeys.parse);
    let replayAsync = Promise.promisify(libkb.SigChain.replay);

    let cachedPublicKeys = `${username}.${uid}.public_keys.json`;
    let cachedSigchain = `${username}.${uid}.sigchain.json`;

    return this.keybaseRemote.userLookup({
      usernames: [ username ],
      fields: [ 'public_keys' ]
    }).then((result) => {
      return result.them[0].public_keys;
    }, (err) => {
      console.error('There was an error', err);
      console.log('Attempting to load from cache, if exists');

      let cachedFile = path.join(this._configurationDirPath, cachedPublicKeys);
      return fs.accessAsync(cachedFile, fs.F_OK).then(() => {
        return fs.readFileAsync(cachedFile).then(JSON.parse);
      });
    }).then((public_keys) => {
      let cachedFile = path.join(this._configurationDirPath, cachedPublicKeys);
      fs.writeFileAsync(cachedFile, JSON.stringify(public_keys)).then(() => {
        console.log('Wrote user public_keys to cache file successfully');
      }, (err) => {
        console.error('Unable to write public_keys cache file', err);
      });

      let key_bundles = public_keys.all_bundles;
      return [
        public_keys.eldest_kid,
        parseAsync({ key_bundles })
      ];
    }).spread((eldest_kid, [ parsed_keys ]) => {
      let log = (msg) => console.log(msg);

      return this.keybaseRemote.sigChainForUid(uid).then(({ sigs: sig_blobs }) => {
        let cachedFile = path.join(this._configurationDirPath, cachedSigchain);
        fs.writeFileAsync(cachedFile, JSON.stringify(sig_blobs)).then(() => {
          console.log('Wrote user sigchain to cache file successfully');
        }, (err) => {
          console.error('Unable to write sigchain cache file', err);
        });

        return sig_blobs;
      }, (err) => {
        let cachedFile = path.join(this._configurationDirPath, cachedSigchain);
        return fs.accessAsync(cachedFile, fs.F_OK).then(() => {
          return fs.readFileAsync(cachedFile).then(JSON.parse);
        });
        //throw err;
      }).then((sig_blobs) => {
        return replayAsync({
          sig_blobs, parsed_keys,
          username, uid,
          eldest_kid,
          log
        });
      }).then((res) => {
        if (username === this.username & uid === this.uid) {
          this._cachedPrimarySigChain = res;
        }

        this.trigger({ username, uid, res });
        return res;
      });
    });
  }

  // Private methods

  _checkConfigurationDirectoryExists() {
    fs.access(this._configurationDirPath, fs.F_OK, (err) => {
      if (err) {
        console.log('[PGP] Configuration directory missing, creating');
        fs.mkdir(this._configurationDirPath, (err) => {
          if (err) {
            console.error('[PGP] Configuration directory creation unsuccessful', err);
          } else {
            console.log('[PGP] Configuration directory creation successful');
          }
        });
      }
    });
  }

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
