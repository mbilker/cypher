import libkb from 'libkeybase';
import NylasStore from 'nylas-store';

import KeybaseActions from './keybase-actions';
import KeybaseRemote from '../keybase-integration';

class KeybaseStore extends NylasStore {
  constructor() {
    super();

    this.keybaseRemote = new KeybaseRemote();
    this.keybaseRemote.loadPreviousLogin();

    this._fetchAndVerifySigChain = this._fetchAndVerifySigChain.bind(this);

    this.listenTo(KeybaseActions.fetchAndVerifySigChain, this._fetchAndVerifySigChain);
  }

  // Action Trigges

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
        console.log(res);

        global.$pgpSigchain = res;
        this.trigger({ username, uid, res });

        return res;
      });
    });
  }
}

export default new KeybaseStore();
