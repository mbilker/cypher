import child_process from 'child_process';

import smalltalk from 'smalltalk';

import proto from './worker/worker-protocol';
import FlowError from './flow-error';

export default class WorkerFrontend {
  constructor() {
    this.workerEntryScriptPath = path.join(__dirname, 'worker', 'worker-entry.js');

    this.forkProcess = this.forkProcess.bind(this);
    this.decrypt = this.decrypt.bind(this);
    this._requestPassphrase = this._requestPassphrase.bind(this);

    global.$pgpWorkerFrontend = this;
  }

  forkProcess() {
    // We need to find out the path of the compile-cache module so we can
    // pass it on to the worker process, use the hijacked require to ensure it
    // is in the module cache
    let nylasExports = require('nylas-exports');
    let compileCache = nylasExports.require('PGP-CompileCache', 'compile-cache');
    let compileCachePath = compileCache.getCacheDirectory();

    var modulePath = '';
    Object.keys(require.cache).some((module) => {
      if (module.match(/compile-cache/)) {
        modulePath = module;
        return true;
      }
    });

    console.log(modulePath);
    console.log(compileCachePath);

    this._child = child_process.fork(this.workerEntryScriptPath, {
      env: Object.assign({}, process.env, {
        PGP_COMPILE_CACHE_MODULE_PATH: modulePath,
        PGP_COMPILE_CACHE_PATH: compileCachePath,
        PGP_CONFIG_DIR_PATH: NylasEnv.getConfigDirPath()
      })
    });

    this._child.on('message', (message) => {
      if (message.method === proto.ERROR_OCCURRED) {
        let error = new FlowError(message.errorMessage || 'unknown error, check error.childStackTrace', true);
        error.childStackTrace = message.errorStackTrace;
        console.error('[PGP - WorkerFrontend] Error from worker:', error);
        console.error(error.childStackTrace);
      } else if (message.method === proto.VERBOSE_OUT) {
        console.log('[PGP - WorkerVerbose] %s', message.message);
      } else if (message.method === proto.REQUEST_PASSPHRASE) {
        this._requestPassphrase(message.id, message.message);
      } else {
        console.log('[PGP - WorkerFrontend] Unknown Message Received From Worker: %s', message);
      }
    });
  }

  smalltalkDisplay() {
    return smalltalk;
  }

  decrypt() {
    this.forkProcess();
    throw new FlowError('Not implemented', true);
  }

  _requestPassphrase(id, msg) {
    smalltalk.passphrase('PGP Passphrase', msg || '').then((passphrase) => {
      this._child.send({ method: proto.PROMISE_RESOLVE, id, result: passphrase });
    }, () => {
      this._child.send({ method: proto.PROMISE_REJECT, id });
    });
  }
}
