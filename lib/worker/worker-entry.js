// This is the main entry-point for the worker process. The `compile-cache` is
// used here to speed up the initialization part

var proto = require('./worker-protocol');

if (!process.send) {
  return console.error('This is an IPC worker. Use as is intended');
}

[
  'PGP_COMPILE_CACHE_MODULE_PATH',
  'PGP_COMPILE_CACHE_PATH',
  'PGP_CONFIG_DIR_PATH'
].forEach(function(envToCheck) {
  if (!process.env[envToCheck]) {
    var err = new Error('Environment variable ' + envToCheck + ' undefined');
    console.error(err.message);
    console.error(err.stack);
    process.send({
      method: proto.ERROR_OCCURRED,
      err: err,
      errorMessage: err.message
    });
    return process.exit(1);
  }
});

process.on('uncaughtException', function(err) {
  console.error(err);
  process.send({
    method: proto.ERROR_OCCURRED,
    err: err,
    errorMessage: err.message,
    errorStackTrace: err.stack
  });
  process.exit(1);
});

global.NylasEnv = require('./nylas-env-wrapper');

var compileCacheModulePath = process.env.PGP_COMPILE_CACHE_MODULE_PATH;
var compileCachePath = process.env.PGP_COMPILE_CACHE_PATH;

require(compileCacheModulePath).setCacheDirectory(compileCachePath);
process.send({ method: proto.VERBOSE_OUT, message: 'Required the compile cache' });

// The `compile-cache` module handles initializing Babel so ES6 will work from
// this point on. We now hand off the processing to the `event-processor`

require('./event-processor');
