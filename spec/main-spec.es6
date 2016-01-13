import {ComponentRegistry, ExtensionRegistry, PreferencesUIStore} from 'nylas-exports';
import {activate, deactivate} from '../lib/main';

import MessageLoaderExtension from '../lib/message-loader/message-loader-extension';
import MessageLoaderHeader from '../lib/message-loader/message-loader-header';

describe("activate", () => {
  it("should register the composer button and sidebar", () => {
    spyOn(PreferencesUIStore, 'registerPreferencesTab');
    spyOn(ComponentRegistry, 'register');
    spyOn(ExtensionRegistry.MessageView, 'register');
    activate();
    expect(PreferencesUIStore.registerPreferencesTab).toHaveBeenCalled();
    expect(ComponentRegistry.register).toHaveBeenCalledWith(MessageLoaderHeader, {role: 'message:BodyHeader'});
    expect(ExtensionRegistry.MessageView.register).toHaveBeenCalledWith(MessageLoaderExtension);
  });
});

describe("deactivate", () => {
  it("should unregister the composer button and sidebar", () => {
    spyOn(ComponentRegistry, 'unregister');
    deactivate();
    expect(ComponentRegistry.unregister).toHaveBeenCalledWith(MessageLoaderHeader);
  });
});
