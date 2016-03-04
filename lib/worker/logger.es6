import util from 'util';

import proto from './worker-protocol';

export function log(...args) {
  if (process.send) {
    process.send({ method: proto.VERBOSE_OUT, message: util.format.apply(this, args) });
  } else {
    return console.log.apply(console, args);
  }
}

export function error(...args) {
  if (process.send) {
    process.send({ method: proto.ERROR_OCCURRED, err: util.format.apply(this, args) });
  } else {
    return console.error.apply(console, args);
  }
}
