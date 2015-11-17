// Monkey patches `FileDownloadStore._cleanupDownload` until PR #413 is merged

import {FileDownloadStore} from 'nylas-exports';

class FileDownloadStoreMonkeyPatch {
  constructor() {
    this.origMethod = FileDownloadStore._cleanupDownload;

    this.patchMethod = this.patchMethod.bind(this);
  }

  patchMethod() {
    if (FileDownloadStore._cleanupDownload === this.origMethod) {
      FileDownloadStore._cleanupDownload = (function(download) {
        download.abort();
        this.trigger();
        return delete this._downloads[download.fileId];
      }).bind(FileDownloadStore);
    }
  }

  unpatchMethod() {
    FileDownloadStore._cleanupDownload = this.origMethod;
  }
}

export default new FileDownloadStoreMonkeyPatch()
