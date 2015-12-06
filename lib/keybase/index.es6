// There is a bug where the Object.defineProperty on the first line of a ES6
// module with Babel transpiling to ES5 causes an 'Unexpected reserved word'
// error when loading in Electron

import KeybaseIntegration from './keybase-integration';

import {KeybaseActions, KeybaseStore} from './store';

export { KeybaseIntegration };
export { KeybaseActions, KeybaseStore };

let ffs = ([ hello, world, foobar ]) => {
  return;
}
