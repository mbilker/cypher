var child_process = require('child_process');
var fs = require('fs');
var path = require('path');

var child = child_process.fork(path.join(__dirname, 'worker-decrypt2.js'));

child.on('message', function(message) {
  console.log('Child sent message:', message);
});

var protocol = {
  SECRET_KEY: 1,
  PASSPHRASE: 2,
  ENCRYPTED_MESSAGE: 3,
  DECRYPT: 4,
  SECRET_KEY_DECRYPT_TIME: 5,
  MESSAGE_DECRYPT_TIME: 6,
  DECRYPTED_TEXT: 7
}

var key = fs.readFileSync(path.join(process.env.HOME, 'pgpkey'), 'utf8');
var message = fs.readFileSync(process.argv[3] || path.join(process.env.HOME, 'encrypted.asc'), 'utf8');
var passphrase = process.argv[2] || '';

child.send({ method: protocol.SECRET_KEY, secretKey: key });
child.send({ method: protocol.PASSPHRASE, passphrase: passphrase });
child.send({ method: protocol.ENCRYPTED_MESSAGE, encryptedMessage: message });
child.send({ method: protocol.DECRYPT });
