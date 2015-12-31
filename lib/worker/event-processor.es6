import uuid from 'uuid';

import proto from './worker-protocol';
import KbpgpDecryptRoutine from './kbpgp/kbpgp-decrypt';

class EventProcessor {
  constructor() {
    this._pendingPromises = {};

    this.requestPassphrase = this.requestPassphrase.bind(this);
    this._onFrontendMessage = this._onFrontendMessage.bind(this);

    process.on('message', this._onFrontendMessage);
  }

  requestPassphrase() {
    let id = uuid();

    return new Promise((resolve, reject) => {
      this._pendingPromises[id] = {resolve, reject};
      process.send({ method: proto.REQUEST_PASSPHRASE, id });
    });
  }

  _onFrontendMessage(message) {
    if (message.method === proto.PROMISE_RESOLVE && this._pendingPromises[message.id]) {
      this._pendingPromises[message.id].resolve(message.result);
    }

    if (message.method === proto.PROMISE_REJECT && this._pendingPromises[message.id]) {
      this._pendingPromises[message.id].reject(message.result);
    }
  }
}

export default new EventProcessor();
