child_process = require 'child_process'
openpgp = require 'openpgp'

FlowError = require '../flow-error.es6'

# This must be the same as worker-decrypt.js
SECRET_KEY              = 1
PASSPHRASE              = 2
ENCRYPTED_MESSAGE       = 3
DECRYPT                 = 4
SECRET_KEY_DECRYPT_TIME = 5
MESSAGE_DECRYPT_TIME    = 6
DECRYPTED_TEXT          = 7
ERROR_OCCURRED          = 8

class WorkerProcessDecrypter

  # This method spawns the worker, sends the 2 files via IPC. Worker sends
  # decrypted content back.
  # Returns: (@string) decryptedText
  decrypt: (text, pgpkey) ->
    passphrase = NylasEnv.config.get("email-pgp.passphrase-b64") or ''
    child = null

    new Promise((resolve) =>
      child = child_process.fork require('path').join(__dirname, 'worker-decrypt.js')

      promise = new Promise (resolve, reject) ->
        child.on 'message', (message) ->
          if message.method is DECRYPTED_TEXT
            resolve message.text
          else if message.method is SECRET_KEY_DECRYPT_TIME
            console.log "%cDecrypted secret key: #{message.timeElapsed[0] * 1e3 + message.timeElapsed[1] / 1e6}ms", "color:red"
          else if message.method is MESSAGE_DECRYPT_TIME
            console.log "%cDecrypted message: #{message.timeElapsed[0] * 1e3 + message.timeElapsed[1] / 1e6}ms", "color:red"
          else if message.method is ERROR_OCCURRED
            error = new FlowError(message.errorMessage or 'unknown error, check error.childStackTrace', true)
            error.childStackTrace = message.errorStackTrace
            reject error
          else
            console.log message

      child.send
        method: SECRET_KEY
        secretKey: pgpkey.toString()
      child.send
        method: ENCRYPTED_MESSAGE
        encryptedMessage: text
      child.send
        method: PASSPHRASE
        passphrase: new Buffer(passphrase, 'base64').toString()
      child.send
        method: DECRYPT

      resolve promise
    )

module.exports = WorkerProcessDecrypter
