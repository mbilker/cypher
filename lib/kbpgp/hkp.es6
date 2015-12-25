export default class HKP {
  constructor(keyServerBaseUrl) {
    this.lookup = this.lookup.bind(this);
    this._makeFetch = this._makeFetch.bind(this);

    this._baseUrl = keyServerBaseUrl ? keyServerBaseUrl : 'https://pgp.mit.edu';
    this._fetch = (typeof window !== 'undefined' && window.fetch) ? window.fetch : this._makeFetch();
  }

  lookup(options) {
    var uri = this._baseUrl + '/pks/lookup?op=get&options=mr&search=';

    // Really obsure bug here. If we replace fetch(url) later, Electron throws
    // an "Illegal invocation error" unless we unwrap the variable here.
    var fetch = this._fetch;

    if (options.keyId) {
      uri += '0x' + options.keyId;
    } else if (options.query) {
      uri += options.query;
    } else {
      throw new Error('You must provide a query parameter!');
    }

    return fetch(uri).then((response) => {
      return response.text();
    }).then((publicKeyArmored) => {
      if (publicKeyArmored && publicKeyArmored.indexOf('-----END PGP PUBLIC KEY BLOCK-----') > -1) {
        return publicKeyArmored.trim();
      }
    });
  }

  _makeFetch() {
    let request = require('request');

    return (uri) => {
      return new Promise((resolve, reject) => {
        request(uri, (error, response, body) => {
          if (!error && response.statusCode == 200) {
            resolve(body);
          } else {
            reject(error);
          }
        });
      });
    }
  }
}
