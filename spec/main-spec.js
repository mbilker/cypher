/** @babel */

import { ComponentRegistry, ExtensionRegistry, PreferencesUIStore } from 'nylas-exports';

import PGPMain from '../lib/main';
import MessageLoaderExtension from '../lib/message-loader/message-loader-extension';
import MessageLoaderHeader from '../lib/message-loader/message-loader-header';
import WorkerFrontend from '../lib/worker-frontend';
import ComposerLoader from '../lib/composer/composer-loader';

describe("PGPMain", () => {
  describe("::activate(state)", () => {
    it("should register the preferences tab, message header, message loader, and composer button", () => {
      spyOn(PreferencesUIStore, 'registerPreferencesTab');
      spyOn(ComponentRegistry, 'register');
      spyOn(ExtensionRegistry.MessageView, 'register');
      spyOn(WorkerFrontend, 'initialize');

      PGPMain.activate();

      expect(PGPMain._tab).not.toBeNull();
      expect(PreferencesUIStore.registerPreferencesTab).toHaveBeenCalledWith(PGPMain._tab);
      expect(ComponentRegistry.register).toHaveBeenCalledWith(MessageLoaderHeader, {role: 'message:BodyHeader'});
      expect(ExtensionRegistry.MessageView.register).toHaveBeenCalledWith(MessageLoaderExtension);
      expect(WorkerFrontend.initialize).toHaveBeenCalled();
      expect(ComponentRegistry.register).toHaveBeenCalledWith(ComposerLoader, {role: 'Composer:ActionButton'});
    });
  });

  describe("::deactivate()", () => {
    it("should unregister the preferences tab, message header, message loader, and composer button", () => {
      spyOn(PreferencesUIStore, 'unregisterPreferencesTab');
      spyOn(ComponentRegistry, 'unregister');
      spyOn(ExtensionRegistry.MessageView, 'unregister');

      PGPMain.deactivate();

      expect(PreferencesUIStore.unregisterPreferencesTab).toHaveBeenCalledWith(PGPMain._tab.tabId);
      expect(ExtensionRegistry.MessageView.unregister).toHaveBeenCalledWith(MessageLoaderExtension);
      expect(ComponentRegistry.unregister).toHaveBeenCalledWith(MessageLoaderHeader);
      expect(ComponentRegistry.unregister).toHaveBeenCalledWith(ComposerLoader);
    });
  });
});
