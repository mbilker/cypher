/** @babel */
/* eslint guard-for-in: 0 */

import { Reflux } from 'nylas-exports';

const CacheActions = Reflux.createActions([
  'store'
]);

for (const key in CacheActions) {
  CacheActions[key].sync = true;
}

export default CacheActions;
