/** @babel */

import { Reflux } from 'nylas-exports';

const Actions = [
  'login',
  'fetchAndVerifySigChain',
];

Actions.forEach((key) => {
  Actions[key] = Reflux.createAction(name);
  Actions[key].sync = true;
});

export default Actions;
