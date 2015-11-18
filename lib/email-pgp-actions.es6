// Expose missing Reflux
Reflux = require('nylas-exports').require('Reflux', '../node_modules/reflux');

Actions = [
  'encryptMessage',
  'decryptMessage'
];

Actions.forEach((key) => {
  Actions[key] = Reflux.createAction(name);
  Actions[key].sync = true;
});

export default Actions;
