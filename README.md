
# Cypher
## Matt Bilker <me@mbilker.us>

**SLIGHTLY VOLATILE**

Small package for decrypting PGP-encrypted email.

-   Works with Facebook PGP, OS X GPGTools, and command line GnuPG
-   Encryption using PGP public keys
-   Keybase integration with tracked users to allow for easy selection for users

**Incomplete** spec tests are available for this package at the moment. I have not fully
designed them yet.

**Do not** trust the security of this package. It is not audited, fully tested,
or safe at all.

## TODO

- Encryption
  - [x] Form to enter Keybase username
  - [ ] Allow for method of encryption to be set in settings (e.g. smart card through GPG)
- Decryption
  - [ ] TTL for decryption key passphrase
- Keybase.io
  - [x] Login
  - [x] Encryption
  - [ ] Decryption
  - [x] Download "tracked" users list
- Preferences
  - [ ] Option to encrypt whole email with quoted text or without it
  - [ ] Clearsign Signature and Encrypt
- [ ] Better detection of PGP encrypted emails
- [x] Text input for passphrase
- [ ] Spec tests for all features
