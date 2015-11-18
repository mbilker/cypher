openpgp = require 'openpgp'

class InProcessDecrypter
  decrypt: (text, pgpkey) ->
    passphrase = NylasEnv.config.get("email-pgp.passphrase-b64") or ''

    new Promise((resolve) ->
      console.log "Reading secret key"
      key = openpgp.key.readArmored(pgpkey)

      if key.err and key.err.length
        key.err.forEach (a, i) ->
          console.log "Secret key read error [#{i}]:", a
        throw key.err[0]

      console.log "Read secret key"
      resolve [text, key.keys[0]]
    ).spread((text, pgpkey) ->
      console.time "Decrypted secret key"

      # TODO: switch to loading this from user interface
      pgpkey.decrypt(new Buffer(passphrase, 'base64').toString())

      console.timeEnd "Decrypted secret key"

      [text, pgpkey]
    ).spread((text, pgpkey) ->
      openpgp.decryptMessage pgpkey, openpgp.message.readArmored(text)
    )

module.exports = InProcessDecrypter
