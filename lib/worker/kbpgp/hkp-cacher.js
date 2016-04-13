/** @babel */

import fs from 'fs';
import path from 'path';

import { log, error } from '../logger';

// HKP Remote Cacher
//
// Caches the sucessful result from any HKP request in memory and on disk. While
// the in-memory cache may not be entirely useful as KeyStore stores the decoded
// KeyManager in memory, it is still nice to have around.
class HKPCacher {
  constructor() {
    this._memCache = new Map();
    this._cacheDirectory = path.join(NylasEnv.getConfigDirPath(), 'cypher', 'pubkey-cache');

    this.cacheResult = this.cacheResult.bind(this);
    this.isCached = this.isCached.bind(this);
    this._getFilePath = this._getFilePath.bind(this);
    this._ensureCacheDirectoryExists = this._ensureCacheDirectoryExists.bind(this);

    this._ensureCacheDirectoryExists();
  }

  cacheResult(keyId, result) {
    const filePath = this._getFilePath(keyId);
    this._memCache.set(keyId, result);

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, result, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  isCached(keyId) {
    const memcached = this._memCache.get(keyId);
    if (memcached) {
      return Promise.resolve(memcached);
    }

    const filePath = this._getFilePath(keyId);
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    }).then((result) => {
      this._memCache.set(keyId, result);

      return result;
    }, (err) => {
      error('[HKPCacher] Error checking for cached pubkey, assuming false %s', err.stack);

      return false;
    });
  }

  _getFilePath(keyId) {
    return path.join(this._cacheDirectory, `pubkey_${keyId}.asc`);
  }

  _ensureCacheDirectoryExists() {
    fs.access(this._cacheDirectory, fs.F_OK, (err) => {
      if (err) {
        log('[PGP - HKPCacher] Pubkey cache directory missing, creating');
        fs.mkdir(this._cacheDirectory, (err2) => {
          if (err) {
            error('[PGP - HKPCacher] Pubkey cache directory creation unsuccessful', err2.stack);
          } else {
            log('[PGP - HKPCacher] Pubkey cache directory creation successful');
          }
        });
      }
    });
  }
}

export default new HKPCacher();
