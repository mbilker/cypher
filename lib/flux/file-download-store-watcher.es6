import fs from 'fs';
import {FileDownloadStore} from 'nylas-exports';

import FlowError from '../utils/flow-error';
import Logger from '../utils/Logger';

class FileDownloadStoreWatcher {
  constructor() {
    // Object of promises of attachments needed for decryption
    this._deferreds = new Map();

    this.promiseForPendingFile = this.promiseForPendingFile.bind(this);
    this.getFilePromise = this.getFilePromise.bind(this);
    this._onDownloadStoreChange = this._onDownloadStoreChange.bind(this);

    this.log = Logger.create(`FileDownloadStoreWatcher`);

    this._storeUnlisten = FileDownloadStore.listen(this._onDownloadStoreChange);
  }

  // PUBLIC

  promiseForPendingFile(fileId) {
    if (this._deferreds.has(fileId)) {
      return this._deferreds.get(fileId).promise;
    }

    const deferred = Promise.defer();
    this._deferreds.set(fileId, deferred);

    return deferred.promise;
    //.then((text) => {
    //  this._deferreds.delete(fileId);
    //  return text;
    //});
  }

  getFilePromise(fileId) {
    return this._deferreds[fileId];
  }

  unlisten() {
    if (this._storeUnlisten) {
      this._storeUnlisten();
    }
  }

  // PRIVATE

  _onDownloadStoreChange() {
    let changes = FileDownloadStore.downloadDataForFiles([...this._deferreds.keys()]));
    this.log.info('Download Store Changes:', changes);
    Object.keys(changes).forEach((fileId) => {
      let file = changes[fileId];

      if (file.state === 'finished' && this._deferreds.has(file.fileId)) {
        this.log.info(`Checking ${file.fileId}`);

        // TODO: Dedupe the file reading logic into separate method
        fs.accessAsync(file.targetPath, fs.F_OK | fs.R_OK).then(() => {
          this.log.info(`Found downloaded attachment ${fileId}`);

          return fs.readFileAsync(file.targetPath, 'utf8').then((text) => {
            const deferred = this._deferreds.get(file.fileId);
            if (deferred && deferred.resolve) {
              deferred.resolve(text);
              this._deferreds.delete(file.fileId);
            } else {
              console.error('watching promise undefined');
            }
          });
        }).catch((err) => {
          const deferred = this._deferreds.get(file.fileId);
          if (deferred && deferred.reject) {
            deferred.reject(new FlowError('Downloaded attachment inaccessable', true));
            this._deferreds.delete(file.fileId);
          }
        });
      }
    });
  }
}

export default new FileDownloadStoreWatcher();
