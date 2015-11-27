import {ComponentRegistry, MessageStore, PreferencesSectionStore} from 'nylas-exports';

import Config from './settings/config';
import MessageLoaderExtension from './message-loader/message-loader-extension';
import ComposerLoader from './composer/composer-loader';
import MessageLoaderHeader from './message-loader/message-loader-header';

module.exports = {
  // Activate is called when the package is loaded. If your package previously
  // saved state using `serialize` it is provided.
  //
  activate(state) {
    this.state = state;
    this.config = new Config();

    PreferencesSectionStore.registerPreferenceSection(this.config);

    MessageStore.registerExtension(MessageLoaderExtension);
    ComponentRegistry.register(ComposerLoader, { role: 'Composer:ActionButton' });
    ComponentRegistry.register(MessageLoaderHeader, { role: 'message:BodyHeader' });
  },

  // Serialize is called when your package is about to be unmounted.
  // You can return a state object that will be passed back to your package
  // when it is re-activated.
  //
  serialize() {
  },

  // This **optional** method is called when the window is shutting down,
  // or when your package is being updated or disabled. If your package is
  // watching any files, holding external resources, providing commands or
  // subscribing to events, release them here.
  //
  deactivate() {
    PreferencesSectionStore.unregisterPreferenceSection(this.config.sectionId);

    MessageStore.unregisterExtension(MessageLoaderExtension);
    ComponentRegistry.unregister(ComposerLoader)
    ComponentRegistry.unregister(MessageLoaderHeader)
  }
}
