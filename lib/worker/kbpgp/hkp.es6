import HKPCacher from './hkp-cacher';

let request = null;

// HKP Public Key Fetcher
export default class HKP {
  constructor(keyServerBaseUrl) {
    this.lookup = this.lookup.bind(this);
    this._makeFetch = this._makeFetch.bind(this);

    const isBrowserFetch = typeof window !== 'undefined' && window.fetch;

    this._baseUrl = keyServerBaseUrl || 'https://pgp.mit.edu';
    this._fetch = isBrowserFetch ? window.fetch : this._makeFetch();
  }

  lookup(keyId) {
    const uri = `${this._baseUrl}/pks/lookup?op=get&options=mr&search=0x${keyId}`;

    // Really obsure bug here. If we replace fetch(url) later, Electron throws
    // an "Illegal invocation error" unless we unwrap the variable here.
    const fetch = this._fetch;

    return HKPCacher.isCached(keyId).then((result) => {
      if (!result) {
        return fetch(uri).then((response) => response.text()).then((text) => {
          HKPCacher.cacheResult(keyId, text);
          return text;
        });
      }

      return result;
    }).then((publicKeyArmored) => {
      if (publicKeyArmored && publicKeyArmored.indexOf('-----END PGP PUBLIC KEY BLOCK-----') > -1) {
        return publicKeyArmored.trim();
      }
    });
  }

  // For testing without Electron providing fetch API
  _makeFetch() {
    if (!request) {
      request = require('request');
    }

    return (uri) => new Promise((resolve, reject) => {
      request(uri, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          resolve({ text: () => body });
        } else {
          reject(error);
        }
      });
    });
  }
}
