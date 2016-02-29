import fs from 'fs';
import path from 'path';

import NylasStore from 'nylas-store';
import {Utils, FileDownloadStore, MessageBodyProcessor} from 'nylas-exports';

import MimeParser from 'mimeparser';

import EmailPGPFileDownloadStoreWatcher from './email-pgp-file-download-store-watcher';
import EmailPGPActions from './email-pgp-actions';

import InProcessDecrypter from './decryption/in-process-decrypter';
import WorkerFrontend from './worker-frontend';
import FlowError from './flow-error.es6';
import KeyStore from './worker/kbpgp/key-store';

import smalltalk from 'smalltalk';

/**
 * The main management class for the PGP plugin for the decryption function.
 * Handles almost all the decrpytion processing.
 * @class EmailPGPStore
 */
class EmailPGPStore extends NylasStore {
  // THANK YOU GPGTOOLS! The `MimePart+GPGMail.m` is such a good guide to PGP
  // mail decryption
  constructor() {
    super();

    // State-based variables for storing messages when resetting
    // MessageBodyProcessor cache
    this._cachedMessages = {};

    // Store status of message decryption for MessageLoaderHeader
    this._state = {};

    // Binding `this` to each method that uses `this`
    this._decryptMessage = this._decryptMessage.bind(this);
    this._retryMessage = this._retryMessage.bind(this);
    this.mainDecrypt = this.mainDecrypt.bind(this);
    //this._setState = this._setState.bind(this);
    //this._retrievePGPAttachment = this._retrievePGPAttachment.bind(this);
    //this._extractHTML = this._extractHTML.bind(this);
    //this._decryptAndResetCache = this._decryptAndResetCache.bind(this);

    this.listenTo(EmailPGPActions.decryptMessage, this._decryptMessage);
    this.listenTo(EmailPGPActions.retryMessage, this._retryMessage);

    global.$pgpEmailPGPStore = this;
  }

  // PUBLIC

  // GPGTools (and other clients) send two attachments, where the first
  // "metadata" attachment contains the string "Version: 1" and the second
  // attachment is the encrypted message.
  //
  // Though, the "metadata" attachment's `contentType` is
  // 'application/pgp-encrypted' and the encrypted message attachment is
  // 'application/octet-stream', which is annoying to deal with.
  /**
   * @param {object} message - the message from
   */
  shouldDecryptMessage(message) {
    if (message.files.length < 1) {
      console.log(`[PGP] ${message.id}: Failed attachment test`);
      return false;
    }

    let extensionTest = (file) => {
      let ext = file.displayExtension();

      // [@"pgp", @"gpg", @"asc"]
      // https://github.com/GPGTools/GPGMail/blob/master/Source/MimePart%2BGPGMail.m#L643
      if (ext === 'pgp' ||
          ext === 'gpg' ||
          ext === 'asc') {
        return true;
      }

      return false;
    };

    if (!message.files.some(extensionTest)) {
      console.log(`[PGP] ${message.id}: Failed extension test`);
      return false;
    }

    return true;
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

  _decryptMessage(message) {
    console.log('[PGP] Told to decrypt', message);
    this._decryptAndResetCache(message);
  }

  _retryMessage(message) {
    if (this._state[message.id] && this._state[message.id].decrypting) {
      console.log('[PGP] Told to retry decrypt, but in the middle of decryption');
      return false;
    } else {
      console.log('[PGP] Told to retry decrypt', message);
      delete this._state[message.id];
      this._decryptAndResetCache(message);
    }
  }

  // Utils

  _setState(messageId, state) {
    this._state[messageId] = Object.assign(this._state[messageId] || {}, state);
    this.trigger(messageId, this._state[messageId]);
  }

  // PGP MAIN

  // The main brains of this project. This retrieves the attachment and secret
  // key (someone help me find a (secure) way to store the secret key) in
  // parallel. We parse the HTML out of the content, then update the state which
  // triggers a page update
  mainDecrypt(message) {
    if (this._state[message.id]) {
      console.log(`[EmailPGPStore] Already decrypting ${message.id}`);
      return Promise.reject(`Already decrypting ${message.id}`);
    }

    console.group(`[PGP] Message: ${message.id}`);

    this._setState(message.id, {
      decrypting: true
    });

    // More decryption engines will be implemented
    const notify = (msg) => this._setState(message.id, { statusMessage: msg });
    const decrypter = this._selectDecrypter().bind(null, notify);
    const startDecrypt = process.hrtime();

    return this._getAttachmentAndKey(message, notify).spread(decrypter).then((result) => {
      const endDecrypt = process.hrtime(startDecrypt);
      console.log(`[EmailPGPStore] %cDecryption engine took ${endDecrypt[0] * 1e3 + endDecrypt[1] / 1e6}ms`, "color:blue");

      this._setState(message.id, {
        rawMessage: result.text,
        signedBy: result.signedBy
      });

      return result;
    }).then(this._extractHTML).then((match) => {
      this._cachedMessages[message.id] = match;

      this._setState(message.id, {
        decrypting: false,
        decryptedMessage: match,
        statusMessage: null
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
    var keyLocation = path.join(process.env.HOME, 'pgpkey');
    return fs.readFileAsync(keyLocation);
  }

  _retrievePGPAttachment(message, notify) {
    console.log("[EmailPGPStore] Attachments: %d", message.files.length);

    // Check for GPGTools-like message, even though we aren't MIME parsed yet,
    // this still applies because the `octet-stream` attachments take
    // precedence
    // https://github.com/GPGTools/GPGMail/blob/master/Source/MimePart%2BGPGMail.m#L665
    var dataPart = null;
    var dataIndex = null;
    var lastContentType = '';
    if (message.files.length >= 1) {
      let {files} = message;

      files.forEach((file, i) => {
        if ((file.contentType === 'application/pgp-signature') || // EmailPGP-style encryption
            ((file.contentType === 'application/octet-stream' && !dataPart) ||
             (lastContentType === 'application/pgp-encrypted')) || // GPGTools-style encryption
            (file.contentType === 'application/pgp-encrypted' && !dataPart)) { // Fallback
          dataPart = file;
          dataIndex = i;
          lastContentType = file.contentType;
        }
      });
    }

    if (dataPart) {
      let path = FileDownloadStore.pathForFile(dataPart);
      console.log(`[EmailPGPStore] Using file[${dataIndex}] = %O`, dataPart);

      // async fs.exists was throwing because the first argument was true,
      // found fs.access as a suitable replacement
      return fs.accessAsync(path, fs.F_OK | fs.R_OK).then(() => {
        return fs.readFileAsync(path, 'utf8').then((text) => {
          console.log("[EmailPGPStore] Read attachment from disk");
          if (!text) {
            throw new FlowError("No text in attachment", true);
          }
          return text;
        });
      }).catch((err) => {
        notify('Waiting for encrypted message attachment to download...');
        console.log('[EmailPGPStore] Attachment file inaccessable, creating pending promise');
        return EmailPGPFileDownloadStoreWatcher.promiseForPendingFile(dataPart.id);
      });
    } else {
      throw new FlowError("No valid attachment");
    }
  }

  // Retrieves the attachment and encrypted secret key for code divergence later
  _getAttachmentAndKey(message, notify) {
    const keys = {};
    const gpg = KeyStore.getKeysGPG();

    for (let key of gpg) {
      if (!key) continue;
      keys[key.key] = `[${key.type}] ${key.fpr}`;
    }

    return Promise.all([
      this._retrievePGPAttachment(message, notify),
      smalltalk.dropdown('PGP Key', 'Which PGP key should be used for decryption of this message?', keys)
    ]).spread((text, pgpkey) => {
      if (!text) {
        throw new FlowError("No text in attachment", true);
      }
      if (!pgpkey) {
        throw new FlowError("No key in pgpkey variable", true);
      }
      return [text, pgpkey];
    });
  }

  _selectDecrypter() {
    const chosen = "WORKER_PROCESS";
    decrypter = WorkerFrontend; // WORKER_PROCESS

    if (chosen === "IN_PROCESS") {
      ecrypter = new InProcessDecrypter(); // IN_PROCESS
    }

    return decrypter.decrypt;
  }

  // Uses regex to extract HTML component from a multipart message. Does not
  // contribute a significant amount of time to the decryption process.
  _extractHTML(result) {
    return new Promise((resolve, reject) => {
      let parser = new MimeParser();

      // Use MIME parsing to extract possible body
      var matched, lastContentType;
      let start = process.hrtime();

      parser.onbody = (node, chunk) => {
        if ((node.contentType.value === 'text/html') || // HTML body
            (node.contentType.value === 'text/plain' && !matched)) { // Plain text
          matched = new Buffer(chunk).toString('utf8');
          lastContentType = node.contentType.value;
        }
      };
      parser.onend = () => {
        let end = process.hrtime(start);
        console.log(`[EmailPGPStore] %cParsed MIME in ${end[0] * 1e3 + end[1] / 1e6}ms`, "color:blue");
      };

      parser.write(result.text);
      parser.end();

      // Fallback to regular expressions method
      if (!matched) {
        start = process.hrtime();
        let matches = /\n--[^\n\r]*\r?\nContent-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)\n\r?\n--/gim.exec(text);
        let end = process.hrtime(start);
        if (matches) {
          console.log(`[EmailPGPStore] %cRegex found HTML in ${end[0] * 1e3 + end[1] / 1e6}ms`, "color:blue");
          matched = matches[1];
        }
      }

      if (matched) {
        resolve(matched);
      } else {
        // REALLY FALLBACK TO RAW
        console.error('[EmailPGPStore] FALLBACK TO RAW DECRYPTED');
        let formatted = `<html><head></head><body><b>FALLBACK TO RAW:</b><br>${text}</body></html>`;
        resolve(formatted);
        //reject(new FlowError("no HTML found in decrypted"));
      }
    });
  }

  _decryptAndResetCache(message) {
    let key = MessageBodyProcessor._key(message);

    return this.mainDecrypt(message).then(() => {
      if (this._state[message.id] && !this._state[message.id].lastError) {
        // Runs resetCache every run, and there can be many messages in a thread
        // that are encrypted. TODO: need a way to track currently processing
        // messages and run resetCache once, or only reprocess one message.
        //MessageBodyProcessor.resetCache();

        var messageIndex = null;
        MessageBodyProcessor._recentlyProcessedA.some(({key: _key, body}, i) => {
          if (key === _key) {
            messageIndex = i;
            return true;
          }

          return false;
        });

        if (messageIndex !== null) {
          MessageBodyProcessor._recentlyProcessedA.splice(messageIndex, 1);
          delete MessageBodyProcessor._recentlyProcessedD[key];
        }

        let processed = MessageBodyProcessor.process(message);
        MessageBodyProcessor._subscriptions.forEach(({message: _message, callback}) => {
          if (message.id === _message.id) {
            callback(processed);
          }
        });
      }
    }).catch((err) => {
      console.log('[PGP - EmailPGPStore] %s', err);
    });
  }
}

export default new EmailPGPStore();
