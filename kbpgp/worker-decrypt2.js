// Decrypt Worker
//
// Decrypting function of openpgpjs takes too much time. This worked will
// prevent UI freezing.

var kbpgp = require('kbpgp');

if (!process.send) {
  return console.error('This is an IPC worker. Use as is intended');
}

var d = require('domain').create();

var SECRET_KEY              = 1;
var PASSPHRASE              = 2;
var ENCRYPTED_MESSAGE       = 3;
var DECRYPT                 = 4;
var SECRET_KEY_DECRYPT_TIME = 5;
var MESSAGE_DECRYPT_TIME    = 6;
var DECRYPTED_TEXT          = 7;
var ERROR_OCCURRED          = 8;

d.on('error', function(err) {
  console.log('ERROR in program routine', err.stack);
  process.send({ method: ERROR_OCCURRED, err: err, errorMessage: err.message, errorStackTrace: err.stack });

  process.exit(1);
});

//process.send({ hello: 'world', spam: 'meat' });

var ring = new kbpgp.keyring.PgpKeyRing();
var secretKey = null;
var encryptedMessage = null;

function decryptRoutine() {
  var startTime = process.hrtime();
  console.log(ring);
  kbpgp.unbox({ keyfetch: ring, armored: encryptedMessage }, d.intercept(function(literals) {
    var elapsed = process.hrtime(startTime);

    ring = new kbpgp.keyring.KeyRing();
    encryptedMessage = secretKey = null;

    process.send({ method: MESSAGE_DECRYPT_TIME, timeElapsed: elapsed });
    process.send({ method: DECRYPTED_TEXT, text: literals[0].toString() });

    setImmediate(function() {
      process.exit(0);
    });
  }));
}

function unlockSecretKey(passphrase) {
  if (secretKey.is_pgp_locked()) {
    var startTime = process.hrtime();
    secretKey.unlock_pgp({
      passphrase: passphrase
    }, d.intercept(function() {
      var elapsed = process.hrtime(startTime);
      console.log('secret key unlocked');

      ring.add_key_manager(secretKey);

      process.send({ method: SECRET_KEY_DECRYPT_TIME, timeElapsed: elapsed });
    }));
  }
}

process.on('message', d.bind(function(message) {
  if (message.method == SECRET_KEY) {
    console.log('parent sent secret key');

    kbpgp.KeyManager.import_from_armored_pgp({
      armored: message.secretKey
    }, d.intercept(function(localSecretKey) {
      secretKey = localSecretKey;
    }));
  } else if (message.method == PASSPHRASE) {
    console.log('parent sent secret key passphrase');

    unlockSecretKey(message.passphrase);
  } else if (message.method == ENCRYPTED_MESSAGE) {
    console.log('parent sent encrypted message');

    encryptedMessage = message.encryptedMessage;
  } else if (message.method == DECRYPT) {
    decryptRoutine();
  }
}));
