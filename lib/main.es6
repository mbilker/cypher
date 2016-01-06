import {ComponentRegistry, ExtensionRegistry, PreferencesUIStore} from 'nylas-exports';

import PreferencesComponent from './settings/preferences-component';
import MessageLoaderExtension from './message-loader/message-loader-extension';
import ComposerLoader from './composer/composer-loader';
import MessageLoaderHeader from './message-loader/message-loader-header';
import WorkerFrontend from './worker-frontend';

exports.config = {
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
}

var _state = {};
var _tab;
var _loadSettings = {};

// Activate is called when the package is loaded. If your package previously
// saved state using `serialize` it is provided.
//
export function activate(state) {
  _loadSettings = NylasEnv.getLoadSettings();
  let windowType = _loadSettings.windowType;

  if (windowType === 'default') {
    _state = state;
    _tab = new PreferencesUIStore.TabItem({
      tabId: "PGP",
      displayName: "PGP Mail",
      component: PreferencesComponent
    });

    WorkerFrontend.initialize();

    PreferencesUIStore.registerPreferencesTab(_tab);
    ComponentRegistry.register(MessageLoaderHeader, { role: 'message:BodyHeader' });
    ExtensionRegistry.MessageView.register(MessageLoaderExtension);
  }

  if (windowType === 'default' || windowType === 'composer') {
    ComponentRegistry.register(ComposerLoader, { role: 'Composer:ActionButton' });
  }
}

// Serialize is called when your package is about to be unmounted.
// You can return a state object that will be passed back to your package
// when it is re-activated.
export function serialize() {
}

// This **optional** method is called when the window is shutting down,
// or when your package is being updated or disabled. If your package is
// watching any files, holding external resources, providing commands or
// subscribing to events, release them here.
export function deactivate() {
  let windowType = _loadSettings.windowType;

  if (windowType === 'default') {
    PreferencesUIStore.unregisterPreferencesTab(_tab.tabId);
    ExtensionRegistry.MessageView.unregister(MessageLoaderExtension);
    ComponentRegistry.unregister(MessageLoaderHeader);
  }

  if (windowType === 'default' || windowType === 'composer') {
    ComponentRegistry.unregister(ComposerLoader);
  }
}
