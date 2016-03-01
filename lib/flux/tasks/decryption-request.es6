export default class DecryptionRequest {
  constructor(parent, messageId, decrypter) {
    this.store = parent;
    this.messageId = messageId;
    this.decrypter = decrypter;
  }

  setState(state) {
    this.store._setState(this.messageId, state);
  }

  notify(msg) {
    this.setState({ statusMessage: msg });
  }

  onMatch(match) {
    this.store.cacheMessage(message.id, match);
    this.setState({
      decrypting: false,
      decryptedMessage: match,
      statusMessage: null
    });

    return match;
  }

  run() {
    this.setState({ decrypting: true });

    const startDecrypt = process.hrtime();
    return this.store.getAttachmentAndKey(message, notify)
      .spread(decrypter)
      .then((result) => {
        const endDecrypt = process.hrtime(startDecrypt);
        console.log(`[EmailPGPStore] %cDecryption engine took ${endDecrypt[0] * 1e3 + endDecrypt[1] / 1e6}ms`, "color:blue");

        this.setState({ rawMessage: result.text, signedBy: result.signedBy });
        return result;
      })
      .then(extractHTML)
      .then(this.onMatch);
  }
}
