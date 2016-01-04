import child_process from 'child_process';
import nylasExports from 'nylas-exports';

import smalltalk from 'smalltalk';
import uuid from 'uuid';

import proto from './worker/worker-protocol';
import FlowError from './flow-error';

class WorkerFrontend {
  constructor() {
    this._workerEntryScriptPath = path.join(__dirname, 'worker', 'worker-entry.js');
    this._pendingPromises = {};

    this.decrypt = this.decrypt.bind(this);
    this._forkProcess = this._forkProcess.bind(this);
    this._requestPassphrase = this._requestPassphrase.bind(this);

    this._forkProcess();

    global.$pgpWorkerFrontend = this;
  }

  decrypt(notify, armored, secretKey) {
    let id = uuid();

    return new Promise((resolve, reject) => {
      this._pendingPromises[id] = {resolve, reject, notify};

      this._child.send({ method: proto.DECRYPT, id, armored, secretKey });
    });
  }

  _forkProcess() {
    // We need to find out the path of the compile-cache module so we can
    // pass it on to the worker process, use the hijacked require to ensure it
    // is in the module cache
    let compileCache = nylasExports.require('PGP-CompileCache', 'compile-cache');
    let compileCachePath = compileCache.getCacheDirectory();

    var modulePath = '';
    Object.keys(require.cache).some((module) => {
      if (module.match(/compile-cache/)) {
        modulePath = module;
        return true;
      }
    });

    this._child = child_process.fork(this._workerEntryScriptPath, {
      env: Object.assign({}, process.env, {
        PGP_COMPILE_CACHE_MODULE_PATH: modulePath,
        PGP_COMPILE_CACHE_PATH: compileCachePath,
        PGP_CONFIG_DIR_PATH: NylasEnv.getConfigDirPath()
      })
    });

    this._child.on('message', (message) => {
      if (message.method === proto.ERROR_OCCURRED) {
        // ERROR_OCCURRED
        let error = new FlowError(message.errorMessage || 'unknown error, check error.childStackTrace', true);
        error.childStackTrace = message.errorStackTrace;
        console.error('[PGP - WorkerFrontend] Error from worker:', error);
        console.error(error.childStackTrace);
      } else if (message.method === proto.VERBOSE_OUT) {
        // VERBOSE_OUT
        console.log('[PGP - WorkerVerbose] %s', message.message);
      } else if (message.method === proto.REQUEST_PASSPHRASE) {
        // REQUEST_PASSPHRASE
        this._requestPassphrase(message.id, message.message);
      } else if (message.method === proto.DECRYPTION_RESULT) {
        // DECRYPTION_RESULT
        if (this._pendingPromises[message.id]) {
          this._pendingPromises[message.id].resolve(message.result);
          delete this._pendingPromises[message.id];
        }
      } else if (message.method === proto.PROMISE_REJECT && this._pendingPromises[message.id]) {
        // PROMISE_REJECT
        this._pendingPromises[message.id].reject(new FlowError(message.result, true));
        delete this._pendingPromises[message.id];
      } else if (message.method === proto.PROMISE_NOTIFY && this._pendingPromises[message.id]) {
        // PROMISE_NOTIFY
        this._pendingPromises[message.id].notify(message.result);
      } else {
        console.log('[PGP - WorkerFrontend] Unknown Message Received From Worker: %O', message);
      }
    });
  }

  _requestPassphrase(id, msg) {
    smalltalk.passphrase('PGP Passphrase', msg || '').then((passphrase) => {
      this._child.send({ method: proto.PROMISE_RESOLVE, id, result: passphrase });
    }, () => {
      this._child.send({ method: proto.PROMISE_REJECT, id });
    });
  }
}

export default new WorkerFrontend();
