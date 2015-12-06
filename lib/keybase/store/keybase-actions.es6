// Expose missing Reflux
Reflux = require('nylas-exports').require('Reflux', '../node_modules/reflux');

Actions = [
  'login',
  'fetchAndVerifySigChain'
];

Actions.forEach((key) => {
  Actions[key] = Reflux.createAction(name);
  Actions[key].sync = true;
});

export default Actions;
