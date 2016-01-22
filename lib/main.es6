import {ComponentRegistry, ExtensionRegistry, PreferencesUIStore} from 'nylas-exports';

import PreferencesComponent from './settings/preferences-component';
import MessageLoaderExtension from './message-loader/message-loader-extension';
import MessageLoaderHeader from './message-loader/message-loader-header';
import WorkerFrontend from './worker-frontend';
import ComposerLoader from './composer/composer-loader';
import KeybaseSidebar from './keybase-sidebar';

class PGPMain {
  config = {
    keybase: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          default: ''
        },
        uid: {
          type: 'string',
          default: ''
        },
        csrf_token: {
          type: 'string',
          default: ''
        },
        session_token: {
          type: 'string',
          default: ''
        }
      }
    }
  };

  _state = {};
  _tab = null;

  constructor() {
    this.activate = this.activate.bind(this);
    this.serialize = this.serialize.bind(this);
    this.deactivate = this.deactivate.bind(this);
  }

  // Activate is called when the package is loaded. If your package previously
  // saved state using `serialize` it is provided.
  //
  activate(state) {
    let _loadSettings = NylasEnv.getLoadSettings();
    let windowType = _loadSettings.windowType;

    if (windowType === 'default') {
      this._state = state;
      this._tab = new PreferencesUIStore.TabItem({
        tabId: "PGP",
        displayName: "PGP Mail",
        component: PreferencesComponent
      });

      WorkerFrontend.initialize();

      PreferencesUIStore.registerPreferencesTab(this._tab);
      ComponentRegistry.register(MessageLoaderHeader, {role: 'message:BodyHeader'});
      ComponentRegistry.register(KeybaseSidebar, {role: 'MessageListSidebar:ContactCard'});
      ExtensionRegistry.MessageView.register(MessageLoaderExtension);
    }

    if (windowType === 'default' || windowType === 'composer') {
      ComponentRegistry.register(ComposerLoader, {role: 'Composer:ActionButton'});
    }
  }

  // Serialize is called when your package is about to be unmounted.
  // You can return a state object that will be passed back to your package
  // when it is re-activated.
  serialize() {
  }

  // This **optional** method is called when the window is shutting down,
  // or when your package is being updated or disabled. If your package is
  // watching any files, holding external resources, providing commands or
  // subscribing to events, release them here.
  deactivate() {
    let _loadSettings = NylasEnv.getLoadSettings();
    let windowType = _loadSettings.windowType;

    if (windowType === 'default') {
      PreferencesUIStore.unregisterPreferencesTab(this._tab.tabId);
      ExtensionRegistry.MessageView.unregister(MessageLoaderExtension);
      ComponentRegistry.unregister(MessageLoaderHeader);
    }

    if (windowType === 'default' || windowType === 'composer') {
      ComponentRegistry.unregister(ComposerLoader);
    }
  }
}

export default new PGPMain();
