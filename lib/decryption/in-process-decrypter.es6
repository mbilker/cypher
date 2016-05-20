import openpgp from 'openpgp';
import smalltalk from 'smalltalk';

import Logger from '../utils/Logger';

class InProcessDecrypter {
  constructor() {
    super();

    this.log = Logger.create('InProcessDecrypter');
  }

  decrypt(text, pgpkey) {
    return new Promise((resolve, reject) => {
      this.log.info('Reading secret key');
      const key = openpgp.key.readArmored(pgpkey);

      if (key.err && key.err.length) {
        key.err.forEach((a, i) => {
          this.log.error(`Secret key read error [${i}]:`, a);
        });

        reject(key.err[0]);
        return;
      }

      this.log.info('Read secret key');
      resolve(key.keys[0]);
    }).then((km) => {
      const startTime = process.hrtime();

      // TODO: get key fingerprint from openpgpjs
      const msg = `PGP Key with fingerprint <tt>TODO</tt> needs to be decrypted`;
      return smalltalk.passphrase('PGP Passphrase', msg).then((passphrase) => {
        km.decrypt(passphrase);

        const elapsed = process.hrtime(startTime);
        this.log.info(`Decrypted secret key in ${elapsed[0] * 1e3 + elapsed[1] / 1e6}ms`);

        return km;
      });
    }).then((km) =>
      openpgp.decryptMessage(km, openpgp.message.readArmored(text))
    );
  }
}

export default InProcessDecrypter;
