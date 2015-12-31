import {MessageViewExtension} from 'nylas-exports';

import EmailPGPStore from '../email-pgp-store';
import Actions from '../email-pgp-actions';

class MessageLoaderExtension extends MessageViewExtension {
  // CANNOT crash here. If we do, the whole app stops working
  // properly and the main screen is stuck with the message
  // viewer
  static formatMessageBody(message) {
    // Check for a cached message body for a decrypted message
    // If we have one we should return the cached message so the
    // proper message body is displayed
    let cached = EmailPGPStore.getCachedBody(message);
    if (cached) {
      console.log(`Have cached body for ${message.id}`);
      return message.body = cached;
    }

    // If we don't have a cached copy and the message matches the parameters for
    // decryption, then signal the `EmailPGPStore` to decrypt the message and
    // pass on the cloned message
    if (EmailPGPStore.shouldDecryptMessage(message)) {
      console.log(`[PGP] MessageLoaderExtension formatting ${message.id}`);
      Actions.decryptMessage(message);
    }
  }
}

export default MessageLoaderExtension;
