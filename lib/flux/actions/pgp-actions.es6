/* eslint guard-for-in: 0 */

import { Reflux } from 'nylas-exports';

const MessageActions = Reflux.createActions([
  'decrypt',
  'retry',
]);

for (const key in MessageActions) {
  MessageActions[key].sync = true;
}

export default MessageActions;
