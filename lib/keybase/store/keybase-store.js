/** @babel */

import fs from 'fs';
import path from 'path';

import libkb from 'libkeybase';
import NylasStore from 'nylas-store';

import KeybaseActions from './keybase-actions';
import KeybaseRemote from '../keybase-integration';

import Logger from '../../utils/Logger';

class KeybaseStore extends NylasStore {
  _configurationDirPath = path.join(NylasEnv.getConfigDirPath(), 'cypher');

  constructor() {
    super();

    this._cachedPrimarySigChain = null;

    this.getPrimarySigChain = this.getPrimarySigChain.bind(this);
    this.getTrackedUsers = this.getTrackedUsers.bind(this);
    this._login = this._login.bind(this);
    this._fetchAndVerifySigChain = this._fetchAndVerifySigChain.bind(this);
    this.ensureConfigurationDirectoryExists = this.ensureConfigurationDirectoryExists.bind(this);
    this.loadSavedCredentials = this.loadSavedCredentials.bind(this);

    this.log = Logger.create('KeybaseStore');

    this.listenTo(KeybaseActions.login, this._login);
    this.listenTo(KeybaseActions.fetchAndVerifySigChain, this._fetchAndVerifySigChain);

    this.ensureConfigurationDirectoryExists();
    this.loadSavedCredentials();

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

    const trackingStatus = sigchain
      .get_links()
      .filter((a) => a.type === 'track' || a.type === 'untrack')
      .reduce((origValue, value) => {
        const tracking = origValue;
        const { username } = value.payload.body[value.type].basics;

        tracking[username] = tracking[username] || 0;
        if (value.type === 'track') {
          tracking[username] += 1;
        } else if (value.type === 'untrack') {
          tracking[username] -= 1;
        }

        return tracking;
      }, {});

    return Object.keys(trackingStatus).reduce((array, name) => {
      if (trackingStatus[name] % 2 === 0) {
        array.push(name);
      }
    }, []);
  }

  // Action Trigges

  _login(username, passphrase) {
    KeybaseRemote.login(username, passphrase).then((res) => {
      const { status: { name } } = res;
      let promise = Promise.resolve(true);

      if (name === 'BAD_LOGIN_PASSWORD') {
        this.log.error('Keybase login error: Bad Passphrase');
        promise = Promise.resolve(false);
      } else if (name === 'BAD_LOGIN_USER_NOT_FOUND') {
        this.log.error('Keybase login error: Bad Username or Email');
        promise = Promise.resolve(false);
      } else {
        NylasEnv.config.set('cypher.keybase.username', username);
        NylasEnv.config.set('cypher.keybase.uid', res.uid);
        NylasEnv.config.set('cypher.keybase.csrf_token', res.csrf_token);
        NylasEnv.config.set('cypher.keybase.session_token', res.session);

        const loginFilePath = path.join(this._configurationDirPath, 'keybase_login.json');
        const string = JSON.stringify({
          username,
          uid: res.uid,
          csrf_token: res.csrf_token,
          session_token: res.session,
        });
        promise = fs.writeFileAsync(loginFilePath, string);

        this.loadSavedCredentials();
      }

      this.trigger({ type: 'LOGIN', username, res });

      return promise;
    });
  }

  _fetchAndVerifySigChain(username, uid) {
    const parseAsync = Promise.promisify(libkb.ParsedKeys.parse);
    const replayAsync = Promise.promisify(libkb.SigChain.replay);

    const cachedPublicKeys = `${username}.${uid}.public_keys.json`;
    const cachedSigchain = `${username}.${uid}.sigchain.json`;

    return KeybaseRemote.userLookup({
      usernames: [username],
      fields: ['public_keys'],
    }).then((result) => result.them[0].public_keys, (err) => {
      this.log.error('There was an error', err);
      this.log.info('Attempting to load from cache, if exists');

      const cachedFile = path.join(this._configurationDirPath, cachedPublicKeys);
      return fs.accessAsync(cachedFile, fs.F_OK).then(() =>
        fs.readFileAsync(cachedFile)
      ).then(JSON.parse);
    }).then((publicKeys) => {
      const cachedFile = path.join(this._configurationDirPath, cachedPublicKeys);
      fs.writeFileAsync(cachedFile, JSON.stringify(publicKeys)).then(() => {
        this.log.info('Wrote user public_keys to cache file successfully');
      }, (err) => {
        this.log.error('Unable to write public_keys cache file', err);
      });

      const keyBundles = publicKeys.all_bundles;
      return [
        publicKeys.eldest_kid,
        parseAsync({ key_bundles: keyBundles }),
      ];
    }).spread((eldestKid, [parsedKeys]) => {
      const log = (msg) => this.log.info(msg);

      return KeybaseRemote.sigChainForUid(uid).then(({ sigs }) => {
        const cachedFile = path.join(this._configurationDirPath, cachedSigchain);
        fs.writeFileAsync(cachedFile, JSON.stringify(sigs)).then(() => {
          this.log.info('Wrote user sigchain to cache file successfully');
        }, (err) => {
          this.log.error('Unable to write sigchain cache file', err);
        });

        return sigs;
      }, () => {
        const cachedFile = path.join(this._configurationDirPath, cachedSigchain);
        return fs.accessAsync(cachedFile, fs.F_OK).then(() =>
          fs.readFileAsync(cachedFile)
        ).then(JSON.parse);
        // throw err;
      }).then((sigBlobs) =>
        replayAsync({
          sig_blobs: sigBlobs,
          parsed_keys: parsedKeys,
          username,
          uid,
          eldest_kid: eldestKid,
          log,
        })
      ).then((res) => {
        if (username === this.username && uid === this.uid) {
          this._cachedPrimarySigChain = res;
        }

        this.trigger({ type: 'VERIFIED_SIGCHAIN', username, uid, res });
        return res;
      });
    });
  }

  // Private methods

  ensureConfigurationDirectoryExists() {
    fs.access(this._configurationDirPath, fs.F_OK, (err) => {
      if (err) {
        this.log.info('Configuration directory missing, creating');
        fs.mkdir(this._configurationDirPath, (err2) => {
          if (err) {
            this.log.error('Configuration directory creation unsuccessful', err2);
          } else {
            this.log.info('Configuration directory creation successful');
          }
        });
      }
    });
  }

  loadSavedCredentials() {
    const {
      username,
      uid,
      csrf_token: csrfToken,
      session_token: sessionToken,
    } = NylasEnv.config.get('cypher.keybase') || {};
    this.username = username;
    this.uid = uid;
    this.csrfToken = csrfToken;
    this.sessionToken = sessionToken;

    if (this.username && this.uid) {
      this._fetchAndVerifySigChain(this.username, this.uid);
    }
  }
}

export default new KeybaseStore();
