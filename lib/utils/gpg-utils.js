/** @babel */

/* eslint max-len: [2, 230, 2] */

import os from 'os';
import childProcess from 'child_process';

function getKeys() {
  const keys = [];
  let currentKey = {};

  if ((os.platform() === 'linux' || os.platform() === 'darwin') &&
      !process.env.PATH.includes('/usr/local/bin')) {
    process.env.PATH += ':/usr/local/bin';
  }

  const output = childProcess.execSync('gpg --list-secret-keys --fingerprint').toString();

  for (let line of output.split('\n')) {
    line = line.trim();

    if (line.startsWith('sec#')) {
      continue;
    }

    if (line.startsWith('sec') || line.startsWith('ssb')) {
      // One crazy line of regex for parsing GPG output
      const parsed = /^(sec|ssb) +(?:\w+)?([0-9]*)(?:[a-zA-Z]?)\/([a-zA-Z0-9]*) ((2[0-9]{3})-(1[0-2]|0[1-9])-(0[1-9]|[12]\d|3[01]))(?: \[expires\: )?((2[0-9]{3})-(1[0-2]|0[1-9])-(0[1-9]|[12]\d|3[01]))?/.exec(line).slice(1);

      currentKey = {
        type: parsed[0] === 'sec' ? 'master' : 'subkey',
        size: parsed[1],
        key: parsed[2],
        created: parsed[3],
        expires: parsed[7],
      };
    }

    if (line.startsWith('Key fingerprint')) {
      currentKey.fpr = /^[ ]*Key fingerprint = ((([0-9a-fA-F]{4})[ ]*)+)$/.exec(line)[1];
      keys.push(currentKey);
    }
  }

  return keys;
}

export default {
  getKeys,
};
