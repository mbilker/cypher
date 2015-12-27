// PGP Message Loader
//
// Currently for Facebook PGP-encrypted email, this will detect that Facebook
// puts the PGP encrypted document as the second attachment. It will read the
// attachment from disk asynchrnously with background tasks

import {Utils, MessageBodyProcessor, React} from 'nylas-exports';

import EmailPGPActions from '../email-pgp-actions';
import EmailPGPStore from '../email-pgp-store';
import FlowError from '../flow-error';

class MessageLoaderHeader extends React.Component {
  static displayName = 'MessageLoader'

  static propTypes = {
    message: React.PropTypes.object.isRequired
  }

  constructor(props) {
    super(props);

    // All the methods that depend on `this` instance
    this.componentDidMount = this.componentDidMount.bind(this);
    this.componentWillUnmount = this.componentWillUnmount.bind(this);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this.render = this.render.bind(this);
    this.retryDecryption = this.retryDecryption.bind(this);
    this._onPGPStoreChange = this._onPGPStoreChange.bind(this);

    this.state = EmailPGPStore.getState(this.props.message.id) || {};
  }

  componentDidMount() {
    this._storeUnlisten = EmailPGPStore.listen(this._onPGPStoreChange);

    window.loaderHeader = this;

    // Fixed in nylas/N1@39a142ddcb80c7e1fce22dfe1e0e628272154523
    //if (EmailPGPStore.shouldDecryptMessage(this.props.message)) {
    //  let haveCachedMessageBody = EmailPGPStore.haveCachedBody(this.props.message);
    //  let isntDecrypting = !this.state.decrypting;
    //  let isntDoneDecrypting = !this.state.done;
    //  if (!haveCachedMessageBody && isntDecrypting && isntDoneDecrypting) {
    //    Actions.decryptMessage(this.props.message);
    //  }
    //}
    //
    //let cachedBody = EmailPGPStore.getCachedBody(this.props.message);
    //if (cachedBody) {
    //  this.props.message.body = cachedBody;
    //
    //  let processed = MessageBodyProcessor.process(this.props.message);
    //  MessageBodyProcessor._subscriptions.forEach(({message, callback}) => {
    //    if (message.id === this.props.message.id) {
    //      callback(processed);
    //    }
    //  });
    //}
  }

  componentWillUnmount() {
    if (this._storeUnlisten) {
      this._storeUnlisten();
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) ||
           !Utils.isEqualReact(nextState, this.state);
  }

  render() {
    var display = true;
    var decryptingMessage, errorMessage;
    var className = "pgp-message-header";

    if (this.state.decrypting) {
      decryptingMessage = <span>Decrypting message</span>;
    } else if (this.state.lastError &&
               ((this.state.lastError instanceof FlowError && this.state.lastError.display) ||
                !(this.state.lastError instanceof FlowError))) {
      className += ' pgp-message-header-error';
      errorMessage = <div>
        <span><b>Error: </b>{this.state.lastError.message}</span>
        <a className="pull-right option" onClick={this.retryDecryption}>Retry Decryption</a>
      </div>
    } else {
      display = false;
    }

    if (display) {
      return <div className={className}>
        {decryptingMessage}
        {errorMessage}
      </div>
    } else {
      return <div />;
    }
  }

  retryDecryption() {
    EmailPGPActions.retryMessage(this.props.message);
  }

  _onPGPStoreChange(messageId, state) {
    if (messageId === this.props.message.id) {
      console.log('received event', state);
      this.state = state;
      this.forceUpdate();

      // Fixed in nylas/N1@39a142ddcb80c7e1fce22dfe1e0e628272154523
      //if (state.decryptedMessage) {
      //  this.props.message.body = state.decryptedMessage;
      //}
    }
  }
}

export default MessageLoaderHeader;
