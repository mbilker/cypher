
# Email PGP - Matt Bilker <me@mbilker.us>

**PROOF OF CONCEPT and HIGHLY VOLATILE**

Small package for decrypting PGP-encrypted email.

-   Works with Facebook PGP mail (only kind I receive)
-   Encryption using Keybase tracked users to allow for easy selection for users

Also, *currently* you need to stick your encrypted secret key at `$HOME/gpgkey`.
I am working on configuration options. The passphrase is also tricky. Currently
its stored in the NylasEnv configuration as `email-pgp.passphrase-b64` encoded in
base64.

**No** spec tests are available for this package at the moment. I have not fully
designed them yet.

**Do not** trust the security of this package. It is not audited, fully tested,
or safe at all.

## TODO

- [x] Config page
- Encryption
  - [ ] Form to enter Keybase username
  - [ ] Allow for method of encryption to be set in settings (e.g. smart card through GPG)
- Integrate with Keybase.io
  - [x] Login
  - [x] Encryption
  - [ ] Decryption
  - [x] Download "tracked" users list
    - Thanks to libkeybase-js, this is much easier. Can verify the list as well.
- Preferences
  - Option to encrypt whole email with quoted text or without it
  - Clearsign Signature and Encrypt
- [ ] Better detection of PGP encrypted emails
- [ ] Text input for passphrase
- [ ] Spec tests for all features
