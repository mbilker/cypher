/** @babel */

// Expose missing Reflux
Reflux = require('nylas-exports').require('Reflux', '../node_modules/reflux');

const Actions = Reflux.createActions([
  'decryptMessage',
  'retryMessage'
]);

for (const key in Actions) {
  Actions[key].sync = true;
}

export default Actions;
