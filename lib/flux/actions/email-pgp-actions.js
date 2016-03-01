/** @babel */

import {Reflux} from 'nylas-exports';

const Actions = Reflux.createActions([
  'decryptMessage',
  'retryMessage'
]);

for (const key in Actions) {
  Actions[key].sync = true;
}

export default Actions;
