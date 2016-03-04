import uuid from 'uuid';

import {log} from './logger';
import proto from './worker-protocol';
import KbpgpDecryptController from './kbpgp/kbpgp-decrypt';

class EventProcessor {
  constructor() {
    this._pendingPromises = {};
    this._waitingForPassphrase = {};

    this._kbpgpDecryptController = new KbpgpDecryptController(this);

    this.isWaitingForPassphrase = this.isWaitingForPassphrase.bind(this);
    this.completedPassphrasePromise = this.completedPassphrasePromise.bind(this);
    this.requestPassphrase = this.requestPassphrase.bind(this);
    this._sendError = this._sendError.bind(this);
    this._handleDecryptMessage = this._handleDecryptMessage.bind(this);
    this._onFrontendMessage = this._onFrontendMessage.bind(this);

    process.on('message', this._onFrontendMessage);
  }

  isWaitingForPassphrase(keyId) {
    return this._waitingForPassphrase[keyId];
  }

  completedPassphrasePromise(keyId, err) {
    if (!this._waitingForPassphrase[keyId]) {
      throw new Error('No pending promise for that keyId');
    }

    if (err) {
      this._waitingForPassphrase[keyId].reject(err);
      return err;
    }

    this._waitingForPassphrase[keyId].resolve();
  }

  requestPassphrase(keyId, askString) {
    if (this._waitingForPassphrase[keyId]) {
      return this._waitingForPassphrase[keyId].promise;
    }

    this._waitingForPassphrase[keyId] = {};
    this._waitingForPassphrase[keyId].promise = new Promise((resolve, reject) => {
      this._waitingForPassphrase[keyId].resolve = resolve;
      this._waitingForPassphrase[keyId].reject = reject;
    }).then(() => {
      delete this._waitingForPassphrase[keyId];
    }, err => {
      delete this._waitingForPassphrase[keyId];
      return Promise.reject(err);
    });

    let id = uuid();

    return new Promise((resolve, reject) => {
      this._pendingPromises[id] = {resolve, reject};
      process.send({ method: proto.REQUEST_PASSPHRASE, id, message });
    });
  }

  _sendError(err) {
    process.send({ method: proto.ERROR_OCCURRED, err: err, errorMessage: err.message, errorStackTrace: err.stack });
  }

  _handleDecryptMessage(message) {
    let {id} = message;
    const notify = (result) => {
      process.send({ method: proto.PROMISE_NOTIFY, id, result });
    }

    this._kbpgpDecryptController.decrypt(message, notify).then(({
      literals = [],
      signedBy = '',
      elapsed
    }) => {
      process.send({ method: proto.DECRYPTION_RESULT, id, result: { text: literals[0].toString(), signedBy }, elapsed });
    }).catch((err) => {
      this._sendError(err);
      process.send({ method: proto.PROMISE_REJECT, id, result: err.message });
    });
  }

  _onFrontendMessage(message) {
    if (message.method === proto.DECRYPT) {
      // DECRYPT
      this._handleDecryptMessage(message);
    } else if (message.method === proto.PROMISE_RESOLVE && this._pendingPromises[message.id]) {
      // PROMISE_RESOLVE
      this._pendingPromises[message.id].resolve(message.result);
      delete this._pendingPromises[message.id];
    } else if (message.method === proto.PROMISE_REJECT && this._pendingPromises[message.id]) {
      // PROMISE_REJECT
      this._pendingPromises[message.id].reject(message.result);
      delete this._pendingPromises[message.id];
    } else if (message.method === proto.LIST_PENDING_PROMISES) {
      // LIST_PENDING_PROMISES
      log(JSON.stringify(this._pendingPromises));
      log(JSON.stringify(this._kbpgpDecryptController._waitingForPassphrase));
    }
  }
}

export default new EventProcessor();
