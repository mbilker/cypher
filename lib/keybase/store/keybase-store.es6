import NylasStore from 'nylas-store';

import KeybaseIntegration from './';

import KeybaseActions from './keybase-actions';

class KeybaseStore extends NylasStore {
  constructor() {
    super();

    this.keybaseIntegration = new KeybaseIntegration();
    this.keybaseIntegration.loadPreviousLogin();

    this.fetchAndVerifySigChain = this.fetchAndVerifySigChain.bind(this);

    this.listenTo(KeybaseActions.fetchAndVerifySigChain, this.fetchAndVerifySigChain);
  }

  fetchAndVerifySigChain(username, uid) {
    this.fetchAndVerifySigChain(username, uid).then((res) => {
      this.trigger(res);
    });
  }
}
