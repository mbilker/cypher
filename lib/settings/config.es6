import {PreferencesSectionStore} from 'nylas-exports';

import PreferencesComponent from './preferences-component';

let {SectionConfig} = PreferencesSectionStore;

export default function createSectionConfig() {
  return new SectionConfig({
    icon: 'nylas://preferences/tabs/ic-settigns-general@2x.png',
    sectionId: "PGP",
    displayName: "PGP Mail",
    component: PreferencesComponent
  })
}
