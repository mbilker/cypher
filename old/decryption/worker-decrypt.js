// Decrypt Worker
//
// Decrypting function of openpgpjs takes too much time. This worked will
// prevent UI freezing.

var openpgp = require('openpgp');

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

var secretKey = null;
var encryptedMessage = null;

function decryptRoutine() {
  var startTime = process.hrtime();
  openpgp.decryptMessage(secretKey, encryptedMessage).then(function(text) {
    var elapsed = process.hrtime(startTime);
    secretKey = encryptedMessage = null

    process.send({ method: MESSAGE_DECRYPT_TIME, timeElapsed: elapsed });
    process.send({ method: DECRYPTED_TEXT, text: text });

    setImmediate(function() {
      process.exit(0);
    });
  }, d.bind(function(err) {
    // Throw error to trigger crash
    throw err;
  }));
}

process.on('message', d.bind(function(message) {
  if (message.method == SECRET_KEY) {
    console.log('parent sent secret key');

    secretKey = openpgp.key.readArmored(message.secretKey);
    if (secretKey.err) {
      throw secretKey.err;
    }

    secretKey = secretKey.keys[0];
  } else if (message.method == PASSPHRASE) {
    console.log('parent sent secret key passphrase');

    var startTime = process.hrtime();
    secretKey.decrypt(message.passphrase);
    var elapsed = process.hrtime(startTime);

    var allDecrypted = secretKey.getAllKeyPackets().reduce(function(origValue, newValue) {
      return origValue && newValue.isDecrypted
    }, true);
    if (!allDecrypted) {
      throw new Error("Not all keys decrypted");
    }

    process.send({ method: SECRET_KEY_DECRYPT_TIME, timeElapsed: elapsed });
  } else if (message.method == ENCRYPTED_MESSAGE) {
    console.log('parent sent encrypted message');
    encryptedMessage = openpgp.message.readArmored(message.encryptedMessage);
  } else if (message.method == DECRYPT) {
    decryptRoutine();
  }
}));
