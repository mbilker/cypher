import fs from 'fs';
import {FileDownloadStore} from 'nylas-exports';

class EmailPGPFileDownloadStoreWatcher {
  constructor() {
    // Object of promises of attachments needed for decryption
    this._pendingPromises = {};
    this._watchingFileIds = {};

    this.promiseForPendingFile = this.promiseForPendingFile.bind(this);
    this.getFilePromise = this.getFilePromise.bind(this);
    this._onDownloadStoreChange = this._onDownloadStoreChange.bind(this);

    this._storeUnlisten = FileDownloadStore.listen(this._onDownloadStoreChange);
  }

  // PUBLIC

  promiseForPendingFile(fileId) {
    if (this._pendingPromises[fileId]) {
      return this._pendingPromises[fileId];
    }

    return this._pendingPromises[fileId] = new Promise((resolve, reject) => {
      this._watchingFileIds[fileId] = { resolve, reject };
    }).then((text) => {
      delete this._pendingPromises[fileId];
      return text;
    });
  }

  getFilePromise(fileId) {
    return this._pendingPromises[fileId];
  }

  unlisten() {
    if (this._storeUnlisten) {
      this._storeUnlisten();
    }
  }

  // PRIVATE

  _onDownloadStoreChange() {
    let changes = FileDownloadStore.downloadDataForFiles(Object.keys(this._watchingFileIds));
    //console.log('Download Store Changes:', changes);
    Object.keys(changes).forEach((fileId) => {
      let file = changes[fileId];
      if (file.state === 'finished' && this._watchingFileIds[file.fileId]) {
        console.log(`Checking ${file.fileId}`);
        // TODO: Dedupe the file reading logic into separate method
        fs.accessAsync(file.targetPath, fs.F_OK | fs.R_OK).then(() => {
          console.log(`Found downloaded attachment ${fileId}`);
          return fs.readFileAsync(file.targetPath, 'utf8').then((text) => {
            if (!this._watchingFileIds[file.fileId].resolve) {
              console.error('resolve undefined for some reason');
              console.error(this._watchingFileIds[file.fileId]);
            } else {
              this._watchingFileIds[file.fileId].resolve(text);
              delete this._watchingFileIds[file.fileId];
            }
          });
        }, (err) => {
          this._watchingFileIds[file.fileId].reject(new FlowError('Downloaded attachment inaccessable', true));
          delete this._watchingFileIds[file.fileId];
        });
      }
    });
  }
}

export default new EmailPGPFileDownloadStoreWatcher();
