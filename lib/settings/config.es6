import {PreferencesUIStore} from 'nylas-exports';

import PreferencesComponent from './preferences-component';

export default function createSectionConfig() {
  return new PreferencesUIStore.TabItem({
    tabId: "PGP",
    displayName: "PGP Mail",
    icon: 'nylas://preferences/tabs/ic-settigns-general@2x.png',
    component: PreferencesComponent
  });
}
