import {ComponentRegistry} from 'nylas-exports';

import ComposerLoader from './components/composer-loader';
import MessageLoader from './components/message-loader';

module.exports = {
  // Activate is called when the package is loaded. If your package previously
  // saved state using `serialize` it is provided.
  //
  activate(state) {
    this.state = state;

    ComponentRegistry.register(ComposerLoader, { role: 'Composer:ActionButton' });
    ComponentRegistry.register(MessageLoader, { role: 'message:BodyHeader' });
  }

  // Serialize is called when your package is about to be unmounted.
  // You can return a state object that will be passed back to your package
  // when it is re-activated.
  //
  serialize() {
  }

  // This **optional** method is called when the window is shutting down,
  // or when your package is being updated or disabled. If your package is
  // watching any files, holding external resources, providing commands or
  // subscribing to events, release them here.
  //
  deactivate() {
    ComponentRegistry.unregister(ComposerLoader)
    ComponentRegistry.unregister(MessageLoader)
  }
}
