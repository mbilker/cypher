/** @babel */

import child_process from 'child_process';
import readline from 'readline';
import nylasExports from 'nylas-exports';

import debugSettings from './debug-settings';
import debugInitialize from 'debug/browser';
import smalltalk from 'smalltalk';
import uuid from 'uuid';

import proto from './worker/worker-protocol';
import FlowError from './utils/flow-error';

const debug = debugInitialize('WorkerFrontend');

class WorkerFrontend {
  constructor() {
    this._workerEntryScriptPath = path.join(__dirname, 'worker', 'worker-entry.js');
    this._pendingPromises = {};

    this.decrypt = this.decrypt.bind(this);
    this.initialize = this.initialize.bind(this);
    this._forkProcess = this._forkProcess.bind(this);
    this._requestPassphrase = this._requestPassphrase.bind(this);

    global.$pgpWorkerFrontend = this;
  }

  decrypt(notify, armored, secretKey) {
    let id = uuid();

    return new Promise((resolve, reject) => {
      this._pendingPromises[id] = {resolve, reject, notify};

      this._child.send({ method: proto.DECRYPT, id, armored, secretKey });
    });
  }

  // Called by `main.es6` when the `windowType` matches either `default` or
  // `composer`
  initialize() {
    this._forkProcess();
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
        DEBUG: '*',
        PGP_COMPILE_CACHE_MODULE_PATH: modulePath,
        PGP_COMPILE_CACHE_PATH: compileCachePath,
        PGP_CONFIG_DIR_PATH: NylasEnv.getConfigDirPath()
      }),
      silent: true
    });

    const rlOut = readline.createInterface({
      input: this._child.stdout,
      terminal: false
    });
    const rlErr = readline.createInterface({
      input: this._child.stderr,
      terminal: false
    });

    rlOut.on('line', (data) => {
      debug('[child.stdout] %s', data);
    });
    rlErr.on('line', (data) => {
      debug('[child.stderr] %s', data);
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
        debug('[Verbose] %s', message.message);
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
        debug('Unknown Message Received From Worker: %O', message);
      }
    });
  }

  _requestPassphrase(id, msg) {
    smalltalk.passphrase('PGP Passphrase', msg || '').then((passphrase) => {
      this._child.send({ method: proto.PROMISE_RESOLVE, id, result: passphrase });
      debug('Passphrase entered');
    }, () => {
      this._child.send({ method: proto.PROMISE_REJECT, id });
      debug('Passphrase cancelled');
    });
  }
}

export default new WorkerFrontend();
