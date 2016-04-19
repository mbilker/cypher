/** @babel */

import childProcess from 'child_process';
import path from 'path';
import readline from 'readline';
import nylasExports from 'nylas-exports';

import smalltalk from 'smalltalk';
import uuid from 'uuid';

import proto from './worker/worker-protocol';
import FlowError from './utils/flow-error';
import Logger from './utils/Logger';

class WorkerFrontend {
  constructor() {
    this._workerEntryScriptPath = path.join(__dirname, 'worker', 'worker-entry.js');
    this._deferreds = new Map();

    this.decrypt = this.decrypt.bind(this);
    this.getKeys = this.getKeys.bind(this);
    this.initialize = this.initialize.bind(this);
    this._forkProcess = this._forkProcess.bind(this);
    this._requestPassphrase = this._requestPassphrase.bind(this);

    this.log = Logger.create('WorkerFrontend');

    global.$pgpWorkerFrontend = this;
  }

  decrypt(notify, armored, secretKey) {
    const id = uuid();

    const deferred = Promise.defer();
    deferred.notify = notify;
    this._deferreds.set(id, deferred);

    this._child.send({ method: proto.DECRYPT, id, armored, secretKey });

    return deferred.promise;
  }

  getKeys() {
    const id = uuid();

    const deferred = Promise.defer();
    this._deferreds.set(id, deferred);

    this._child.send({ method: proto.GET_KEYS, id });

    return deferred.promise;
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
    const compileCache = nylasExports.require('PGP-CompileCache', 'compile-cache');
    const compileCachePath = compileCache.getCacheDirectory();

    let modulePath = '';
    Object.keys(require.cache).some((module) => {
      if (module.match(/compile-cache/)) {
        modulePath = module;
        return true;
      }
      return false;
    });

    this._child = childProcess.fork(this._workerEntryScriptPath, {
      env: Object.assign({}, process.env, {
        PGP_COMPILE_CACHE_MODULE_PATH: modulePath,
        PGP_COMPILE_CACHE_PATH: compileCachePath,
        PGP_CONFIG_DIR_PATH: NylasEnv.getConfigDirPath(),
      }),
      silent: true,
    });

    const rlOut = readline.createInterface({
      input: this._child.stdout,
      terminal: false,
    });
    const rlErr = readline.createInterface({
      input: this._child.stderr,
      terminal: false,
    });

    rlOut.on('line', (data) => this.log.info('[child.stdout]', data));
    rlErr.on('line', (data) => this.log.info('[child.stderr]', data));

    this._child.on('message', (message) => {
      if (message.method === proto.ERROR_OCCURRED) {
        // ERROR_OCCURRED
        const errorTitle = message.errorMessage || 'unknown error, check error.childStackTrace';
        const error = new FlowError(errorTitle, true);
        error.childStackTrace = message.errorStackTrace;
        this.log.error('Error from worker:', error, error.childStackTrace);
      } else if (message.method === proto.VERBOSE_OUT) {
        // VERBOSE_OUT
        this.log.info('[Verbose]', message.message);
      } else if (message.method === proto.REQUEST_PASSPHRASE) {
        // REQUEST_PASSPHRASE
        this._requestPassphrase(message.id, message.message);
      } else if (message.method === proto.PROMISE_RESOLVE && this._deferreds.has(message.id)) {
        // PROMISE_RESOLVE
        this._deferreds.get(message.id).resolve(message.result);
        this._deferreds.delete(message.id);
      } else if (message.method === proto.PROMISE_REJECT && this._deferreds.has(message.id)) {
        // PROMISE_REJECT
        this._deferreds.get(message.id).reject(new FlowError(message.result, true));
        this._deferreds.delete(message.id);
      } else if (message.method === proto.PROMISE_NOTIFY && this._deferreds.has(message.id)) {
        // PROMISE_NOTIFY
        this._deferreds.get(message.id).notify(message.result);
      } else {
        this.log.error('Unknown Message Received From Worker:', message);
      }
    });
  }

  _requestPassphrase(id, msg) {
    smalltalk.passphrase('PGP Passphrase', msg || '').then((passphrase) => {
      this._child.send({ method: proto.PROMISE_RESOLVE, id, result: passphrase });
      this.log.info('Passphrase entered');
    }, () => {
      this._child.send({ method: proto.PROMISE_REJECT, id });
      this.log.info('Passphrase cancelled');
    });
  }
}

export default new WorkerFrontend();
