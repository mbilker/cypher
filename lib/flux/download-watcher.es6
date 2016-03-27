import fs from 'fs';
import {FileDownloadStore} from 'nylas-exports';

import FlowError from '../utils/flow-error';
import Logger from '../utils/Logger';

class DownloadWatcher {
  constructor() {
    // Object of promises of attachments needed for decryption
    this.deferreds = new Map();

    this.promiseForPendingFile = this.promiseForPendingFile.bind(this);
    this.getFilePromise = this.getFilePromise.bind(this);
    this.onDownloadStoreChange = this.onDownloadStoreChange.bind(this);

    this.log = Logger.create('DownloadWatcher');

    this._storeUnlisten = FileDownloadStore.listen(this.onDownloadStoreChange);

    global.$pgpDownloadWatcher = this;
  }

  // PUBLIC

  promiseForPendingFile(fileId) {
    if (this.deferreds.has(fileId)) {
      return this.deferreds.get(fileId).promise;
    }

    const deferred = Promise.defer();
    this.deferreds.set(fileId, deferred);

    return deferred.promise;
    //.then((text) => {
    //  this._deferreds.delete(fileId);
    //  return text;
    //});
  }

  getFilePromise(fileId) {
    return this.deferreds[fileId];
  }

  unlisten() {
    if (this._storeUnlisten) {
      this._storeUnlisten();
    }
  }

  fetchFile(filePath) {
    // async fs.exists was throwing because the first argument was true,
    // found fs.access as a suitable replacement
    return fs.accessAsync(filePath, fs.F_OK | fs.R_OK).then(() =>
      fs.readFileAsync(filePath, 'utf8')
    ).then((text) => {
      this.log.info('Read attachment from disk');
      if (!text) {
        return Promise.reject(new FlowError('No text in attachment', true));
      }
      return text;
    });
  }

  /**
   * @private
   * Handles the downloaded files and checks if PGP attachments have been fully
   * downloaded.
   *
   * If the file is in the 'finished' state, then it will read the
   * file from disk and tell the {PGPStore} that the file has downloaded via a
   * promise.
   *
   * If there was an error reading the file from disk, then it will tell
   * {PGPStore} the error to display to the user.
   *
   * TODO: Figure out why this does not handle more than one file.
   */
  onDownloadStoreChange() {
    let changes = FileDownloadStore.downloadDataForFiles([...this.deferreds.keys()]);

    this.log.info('Download Store Changes:', changes);
    Object.keys(changes).forEach((fileId) => {
      const file = changes[fileId];

      if (file && file.state === 'finished' && this.deferreds.has(file.fileId)) {
        this.log.info(`Checking ${file.fileId}`);

        this.fetchFile(file.targetPath).then((text) => {
          const deferred = this.deferreds.get(file.fileId);
          if (deferred && deferred.resolve) {
            this.log.info(`Found downloaded attachment ${fileId}`);
            deferred.resolve(text);
            this._deferreds.delete(file.fileId);
          } else {
            this.log.error('watching promise undefined');
          }
        }).catch((err) => {
          const deferred = this.deferreds.get(file.fileId);
          if (deferred && deferred.reject) {
            this.log.error('Download attachment inaccessable', err);
            deferred.reject(new FlowError('Downloaded attachment inaccessable', true));
            this.deferreds.delete(file.fileId);
          }
        });
      }
    });
  }
}

export default new DownloadWatcher();
