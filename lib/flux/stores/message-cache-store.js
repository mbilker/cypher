/** @babel */

import NylasStore from 'nylas-store';

import CacheActions from '../actions/message-cache-actions';

class MessageCacheStore extends NylasStore {
  constructor() {
    super();

    // State-based variables for storing messages when resetting
    // MessageBodyProcessor cache
    this.cachedMessages = new Map();

    this.listenTo(CacheActions.store, this._store);

    global.$pgpMessageCacheStore = this;
  }

  haveCachedBody(messageId) {
    return this.cachedMessages.has(messageId);
  }

  getCachedBody(messageId) {
    return this.cachedMessages.get(messageId);
  }

  _store(messageId, result) {
    this.cachedMessages.set(messageId, result);
  }
}

export default new MessageCacheStore();
