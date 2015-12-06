import {PreferencesUIStore} from 'nylas-exports';

import PreferencesComponent from './preferences-component';

export default function createSectionConfig() {
  return new PreferencesUIStore.TabItem({
    tabId: "PGP",
    displayName: "PGP Mail",
    component: PreferencesComponent
  });
}
