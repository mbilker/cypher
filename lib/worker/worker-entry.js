// This is the main entry-point for the worker process. The `compile-cache` is
// used here to speed up the initialization part
'use strict';

const proto = require('./worker-protocol');

if (!process.send) {
  console.error('This is an IPC worker. Use as intended');
  process.exit(1);
}

[
  'PGP_COMPILE_CACHE_MODULE_PATH',
  'PGP_COMPILE_CACHE_PATH',
  'PGP_CONFIG_DIR_PATH',
].forEach(envToCheck => {
  if (!process.env[envToCheck]) {
    const err = new Error(`Environment variable ${envToCheck} undefined`);
    console.error(err.message);
    console.error(err.stack);
    process.send({
      method: proto.ERROR_OCCURRED,
      err,
      errorMessage: err.message,
    });
    process.exit(1);
  }
});

process.on('uncaughtException', err => {
  console.error(err);
  process.send({
    method: proto.ERROR_OCCURRED,
    err,
    errorMessage: err.message,
    errorStackTrace: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error(err);
  process.send({
    method: proto.ERROR_OCCURRED,
    err,
    errorMessage: err.message,
    errorStackTrace: err.stack,
  });
});

global.NylasEnv = require('./nylas-env-wrapper');

const compileCacheModulePath = process.env.PGP_COMPILE_CACHE_MODULE_PATH;
const compileCachePath = process.env.PGP_COMPILE_CACHE_PATH;

require(compileCacheModulePath).setCacheDirectory(compileCachePath);
process.send({ method: proto.VERBOSE_OUT, message: 'Required the compile cache' });

// The `compile-cache` module handles initializing Babel so ES6 will work from
// this point on. We now hand off the processing to the `event-processor`

require('./event-processor');
