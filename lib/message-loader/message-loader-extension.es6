import {MessageStoreExtension} from 'nylas-exports';

import EmailPGPStore from './email-pgp-store';

class MessageLoaderExtension extends MessageStoreExtension {
  constructor() {
    super();

    this.formatMessageBody = this.formatMessageBody.bind(this);
  }

  formatMessageBody(message) {
    let cached = EmailPGPStore.getCachedBody(message);
    if (cached) {
      return cached;
    }

    if (EmailPGPStore.shouldDecryptMessage(message)) {
    }

    return message.body;
  }
}
