import fs from 'fs';

import NylasStore from 'nylas-store';
import {Utils, FileDownloadStore, MessageBodyProcessor} from 'nylas-exports';

import EmailPGPFileDownloadStoreWatcher from './email-pgp-file-download-store-watcher';
import EmailPGPActions from './email-pgp-actions';

import InProcessDecrypter from './decryption/in-process-decrypter';
import WorkerProcessDecrypter from './decryption/worker-process-decrypter';
import FlowError from './flow-error.es6';

class EmailPGPStore extends NylasStore {
  constructor() {
    super();

    // State-based variables for storing messages when resetting
    // MessageBodyProcessor cache
    this._cachedMessages = {};

    // Store status of message decryption for MessageLoaderHeader
    this._state = {};

    // Binding `this` to each method that uses `this`
    this._encryptMessage = this._encryptMessage.bind(this);
    this._decryptMessage = this._decryptMessage.bind(this);
    this.mainDecrypt = this.mainDecrypt.bind(this);
    this._setState = this._setState.bind(this);
    this._retrievePGPAttachment = this._retrievePGPAttachment.bind(this);
    this._extractHTML = this._extractHTML.bind(this);
    this._decryptAndResetCache = this._decryptAndResetCache.bind(this);

    this.listenTo(EmailPGPActions.encryptMessage, this._encryptMessage);
    this.listenTo(EmailPGPActions.decryptMessage, this._decryptMessage);

    global.EmailPGPStore = this;
  }

  // PUBLIC

  shouldDecryptMessage(message) {
    if (message.files.length >= 1) {
      return true;
    }

    return false;
  }

  haveCachedBody(message) {
    return !!this._cachedMessages[message.id];
  }

  getCachedBody(message) {
    return this._cachedMessages[message.id];
  }

  getState(messageId) {
    return this._state[messageId];
  }

  // PRIVATE

  // ACTION EVENTS

  _encryptMessage(message) {
  }

  _decryptMessage(message) {
    console.log('[PGP] Told to decrypt', message);
    this._decryptAndResetCache(message);
  }

  // Utils

  _setState(messageId, state) {
    this._state[messageId] = state;
    this.trigger(messageId, this._state[messageId]);
  }

  // PGP MAIN

  // The main brains of this project. This retrieves the attachment and secret
  // key (someone help me find a (secure) way to store the secret key) in
  // parallel. We parse the HTML out of the content, then update the state which
  // triggers a page update
  mainDecrypt(message) {
    console.group(`[PGP] Message: ${message.id}`);

    this._setState(message.id, {
      decrypting: true
    });

    // More decryption engines will be implemented
    let decrypter = this._selectDecrypter();
    let startDecrypt = process.hrtime();
    return this._getAttachmentAndKey(message).spread(decrypter).then((text) => {
      let endDecrypt = process.hrtime(startDecrypt);
      console.log(`%cTotal message decrypt time: ${endDecrypt[0] * 1e3 + endDecrypt[1] / 1e6}ms`, "color:blue");
      return text;
    }).then(this._extractHTML).then((match) => {
      this._cachedMessages[message.id] = match;

      this._setState(message.id, {
        decrypting: false,
        decryptedMessage: match
      });

      return match;
    }).catch((error) => {
      if (error instanceof FlowError) {
        console.log(error.title);
      } else {
        console.log(error.stack);
      }
      this._setState(message.id, {
        decrypting: false,
        done: true,
        lastError: error
      });
    }).finally(() => {
      console.groupEnd();
      //delete this._state[message.id];
    });
  }

  // PGP HELPER INTERFACE

  _getKey() {
    var keyLocation = require('path').join(process.env.HOME, 'pgpkey');
    return fs.readFileAsync(keyLocation, 'utf8');
  }

  _retrievePGPAttachment(message) {
    console.log("Attachments: %d", message.files.length);
    if (message.files.length >= 1) {
      let path = FileDownloadStore.pathForFile(message.files[1]);

      // async fs.exists was throwing because the first argument was true,
      // found fs.access as a suitable replacement
      return fs.accessAsync(path, fs.F_OK | fs.R_OK).then(() => {
        return fs.readFileAsync(path, 'utf8').then((text) => {
          console.log("Read attachment from disk");
          return text;
        });
      }, (err) => {
        console.log('Attachment file inaccessable, creating pending promise');
        return EmailPGPFileDownloadStoreWatcher.promiseForPendingFile(message.files[1].id);
      });
    } else {
      throw new FlowError("No attachments");
    }
  }

  // Retrieves the attachment and encrypted secret key for code divergence later
  _getAttachmentAndKey(message) {
    return new Promise((resolve) => {
      resolve([ this._retrievePGPAttachment(message), this._getKey() ]);
    }).spread((text, pgpkey) => {
      if (!text) {
        throw new Error("No text in attachment");
      }
      if (!pgpkey) {
        throw new Error("No key in pgpkey variable");
      }
      return [text, pgpkey];
    });
  }

  _selectDecrypter() {
    const chosen = "WORKER_PROCESS";
    var decrypter = InProcessDecrypter; // IN_PROCESS

    if (chosen === "WORKER_PROCESS") {
      decrypter = WorkerProcessDecrypter;
    }

    return new decrypter().decrypt;
  }

  _extractHTML(text) {
    let start = process.hrtime();
    let matches = /\n--[^\n\r]*\r?\nContent-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)\n\r?\n--/gim.exec(text);
    let end = process.hrtime(start);
    if (matches) {
      console.log(`%cHTML found in decrypted: ${end[0] * 1e3 + end[1] / 1e6}ms`, "color:blue");
      return matches[1];
    } else {
      throw new FlowError("no HTML found in decrypted");
    }
  }

  _decryptAndResetCache(message) {
    return this.mainDecrypt(message).then(() => {
      MessageBodyProcessor.resetCache();
    });
  }
}

export default new EmailPGPStore();
