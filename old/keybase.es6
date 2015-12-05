import msgpack from 'msgpack-lite';
import naclb from 'naclb';
import request from 'request';
import tweetnacl from 'tweetnacl';

const API = 'https://keybase.io/_/api/1.0';

class KeybaseIntegration {
  loadPGPPublicKeys(username) {
    return Promise.all([
      this.pubKeyForUsername(username)
    ]).spread((pubKey) => {
      let pgpPubKeys = [];

      pubKey = openpgp.key.readArmored(pubKey);

      if (pubKey.err && pubKey.err.length) {
        pubKey.err.forEach((a, i) => {
          console.log(`Public key read error [${i}]:`, a);
        });
        throw pubKey.err[0];
      } else {
        pgpPubKeys = pgpPubKeys.concat(pubKey.keys);
      }

      return pgpPubKeys;
    });
  }

  verifyPGPSignature(pubKeys, sig) {
    let message = openpgp.message.readArmored(sig.sig);
    let result = message.verify(pubKeys);
    if (result.every((a) => a.valid)) {
      console.log(`Signature for ${sig.payload_hash} is valid for personal PGP public key`);
    } else {
      console.log(`Signature for ${sig.payload_hash} is %c valid`, 'color:red;contents:"NOT";');
      console.log(result);
    }

    return Promise.resolve(result);
  }

  // TODO: Use libkeybase-js to load this damned sigchain thing
  fetchAndVerifySigChain(username, uid) {
    return Promise.all([
      this.loadPGPPublicKeys(username),
      this.sigChainForUsername(uid),
      //require('fs').readFileAsync('/home/mbilker/key.asc', 'utf8'),
      //require('fs').readFileAsync('/home/mbilker/json', 'utf8').then((a) => JSON.parse(a))
    ]).spread((pgpPubKeys, res) => {
      // Looping through the array may be problematic with people who have
      // large sigchains
      res.sigs.map((sig) => {
        sig.parsed_json = JSON.parse(sig.payload_json)
        return sig;
      }).forEach((sig) => {
        let kid = new Buffer(sig.kid, 'hex');
        if (kid[0] === 0x01 &&
            kid[1] === 0x01) { // PGP key
          try {
            this.verifyPGPSignature(pgpPubKeys, sig);
          } catch (e) {
            console.log(`Unable to verify signature for ${sig.payload_hash}`);
            console.log(sig);
            console.log(e);
          }
        } else if (kid[0] === 0x01 &&
                   kid[1] === 0x20) {  // EdDSA key
          //console.log(`Cannot fully verify EdDSA signature for ${sig.payload_hash}`);

          let decode = msgpack.decode(new Buffer(sig.sig, 'base64'));
          let keybytes = decode.body.key.slice(2);

          let attached_sig_bytes = Buffer.concat([ decode.body.sig, decode.body.payload ]);
          let unboxed = new Buffer(sig.payload_json.length);
          let signatureVerified = naclb.verify(unboxed, attached_sig_bytes, keybytes);
          let payloadValid = unboxed.toString('utf8') === sig.payload_json;

          if (signatureVerified && payloadValid) {
            console.log(`Signature for EdDSA ${sig.payload_hash} for device key`);
          } else {
            console.log(`Signature for EdDSA ${sig.payload_hash} is %c valid for device key`, 'color:red;contents:"NOT";');
            console.log(verifykey);
            console.log(unboxed.toString('utf8') === sig.payload_json);
          }
        }
      });
    });
  }
}

export default KeybaseIntegration;
