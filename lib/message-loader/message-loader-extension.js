/** @babel */
/* eslint no-param-reassign: 0 */

import { MessageViewExtension } from 'nylas-exports';

import PGPStore from '../flux/stores/pgp-store';
import MessageCacheStore from '../flux/stores/message-cache-store';
import MessageActions from '../flux/actions/pgp-actions';

import Logger from '../utils/Logger';

const log = Logger.create(`MessageLoaderExtension`);

class MessageLoaderExtension extends MessageViewExtension {
  // CANNOT crash here. If we do, the whole app stops working
  // properly and the main screen is stuck with the message
  // viewer
  static formatMessageBody(message) {
    // Check for a cached message body for a decrypted message
    // If we have one we should return the cached message so the
    // proper message body is displayed
    const cached = MessageCacheStore.getCachedBody(message.id);
    if (cached) {
      log.info(`Have cached body for ${message.id}`);
      message.body = cached;

      return;
    }

    // If we don't have a cached copy and the message matches the parameters for
    // decryption, then signal the `EmailPGPStore` to decrypt the message and
    // pass on the cloned message
    if (PGPStore.shouldDecryptMessage(message)) {
      log.info(`MessageLoaderExtension formatting ${message.id}`);
      MessageActions.decrypt(message);
    }
  }
}

export default MessageLoaderExtension;
