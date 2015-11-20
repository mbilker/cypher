import {MessageStoreExtension} from 'nylas-exports';

import EmailPGPStore from '../email-pgp-store';
import Actions from '../email-pgp-actions';

class MessageLoaderExtension extends MessageStoreExtension {
  // CANNOT crash here. If we do, the whole app stops working
  // properly and the main screen is stuck with the message
  // viewer
  static formatMessageBody(message) {
    console.log(`[PGP] MessageLoaderExtension formatting ${message.id}`);
    let cached = EmailPGPStore.getBodyIfCached(message);
    if (cached) {
      console.log(`Have cached body for ${message.id}`);
      return message.body = cached;
    }

    if (EmailPGPStore.shouldDecryptMessage(message)) {
      Actions.decryptMessage(message);
    }

    return message.body;
  }
}

export default MessageLoaderExtension;
