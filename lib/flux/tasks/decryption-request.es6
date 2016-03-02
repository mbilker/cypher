import {extractHTML} from '../../utils/html-parser';
import {selectDecrypter} from '../../decryption';
import CacheActions from '../actions/message-cache-actions';
import FlowError from '../../utils/flow-error';

export default class DecryptionRequest {
  constructor(parent, message) {
    this.store = parent;
    this.message = message;
    this.messageId = message.id;

    this.setState = this.setState.bind(this);
    this.notify = this.notify.bind(this);
    this.onMatch = this.onMatch.bind(this);
    this.onError = this.onError.bind(this);
    this.run = this.run.bind(this);
  }

  setState(state) {
    this.store._setState(this.messageId, state);
  }

  notify(msg) {
    this.setState({ statusMessage: msg });
  }

  onError(err) {
    if (error instanceof FlowError) {
      console.log(error.title);
    } else {
      console.log(error.stack);
    }

    this.setState({
      decrypting: false,
      done: true,
      lastError: error
    });
  }

  onMatch(match) {
    CacheActions.store(this.messageId, match);

    this.setState({
      decrypting: false,
      decryptedMessage: match,
      statusMessage: null
    });

    return match;
  }

  run() {
    this.setState({ decrypting: true });

    const decrypter = selectDecrypter().bind(null, this.notify);
    const startDecrypt = process.hrtime();

    return this.store.getAttachmentAndKey(this.message, this.notify)
      .spread(decrypter)
      .then((result) => {
        const endDecrypt = process.hrtime(startDecrypt);
        console.log(`[DecryptionRequest] %cDecryption engine took ${endDecrypt[0] * 1e3 + endDecrypt[1] / 1e6}ms`, "color:blue");

        this.setState({ rawMessage: result.text, signedBy: result.signedBy });
        return result;
      })
      .then(extractHTML)
      .then(this.onMatch)
      .catch(this.onError);
  }
}
