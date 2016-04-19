/** @babel */

import util from 'util';

import uuid from 'uuid';

import { log } from './logger';
import proto from './worker-protocol';
import KbpgpDecryptController from './kbpgp/kbpgp-decrypt';
// import KeyStore from './kbpgp/key-store';

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
    this._handleGetKeys = this._handleGetKeys.bind(this);
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

  requestPassphrase(keyId, message) {
    if (this._waitingForPassphrase[keyId]) {
      return this._waitingForPassphrase[keyId].promise;
    }

    const deferred = Promise.defer();
    this._waitingForPassphrase[keyId] = deferred;
    this._waitingForPassphrase[keyId].promise = deferred.promise.then(() => {
      delete this._waitingForPassphrase[keyId];
    }, err => {
      delete this._waitingForPassphrase[keyId];
      return Promise.reject(err);
    });

    const id = uuid();

    return new Promise((resolve, reject) => {
      this._pendingPromises[id] = { resolve, reject };
      process.send({ method: proto.REQUEST_PASSPHRASE, id, message });
    });
  }

  _sendError(err) {
    process.send({
      method: proto.ERROR_OCCURRED,
      err,
      errorMessage: err.message,
      errorStackTrace: err.stack,
    });
  }

  _handleDecryptMessage(message) {
    const { id } = message;
    const notify = (result) => {
      process.send({ method: proto.PROMISE_NOTIFY, id, result });
    };

    this._kbpgpDecryptController.decrypt(message, notify).then(({
      literals = [],
      signedBy = '',
      elapsed,
    }) => {
      process.send({
        method: proto.PROMISE_RESOLVE,
        id,
        elapsed,
        result: {
          text: literals[0].toString(),
          signedBy,
        },
      });
    }).catch((err) => {
      this._sendError(err);
      process.send({ method: proto.PROMISE_REJECT, id, result: err.message });
    });
  }

  _handleGetKeys(message) {
    const { id } = message;

    // This is a stopgap
    setImmediate(() => {
      process.send({
        method: proto.PROMISE_RESOLVE,
        id,
        result: [
          {
            type: 'master',
            size: '',
            fpr: 'F779 EF6C 34B4 63E8 AAE8  3A56 F4ED 3753 91FA D78F',
            key: '0xF4ED375391FAD78F',
            created: '2016-04-13',
            expires: null,
          },
        ],
      });
    });
  }

  _onFrontendMessage(message) {
    if (message.method === proto.DECRYPT) {
      // DECRYPT
      this._handleDecryptMessage(message);
    } else if (message.method === proto.GET_KEYS) {
      // GET_KEYS
      this._handleGetKeys(message);
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
      log(util.inspect(this._pendingPromises));
      log(util.inspect(this._waitingForPassphrase));
    }
  }
}

export default new EventProcessor();
