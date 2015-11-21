// PGP Message Loader
//
// Currently for Facebook PGP-encrypted email, this will detect that Facebook
// puts the PGP encrypted document as the second attachment. It will read the
// attachment from disk asynchrnously with background tasks

import {Utils, MessageBodyProcessor, React} from 'nylas-exports';

import EmailPGPStore from '../email-pgp-store';

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
    this._renderErrorMessage = this._renderErrorMessage.bind(this);
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
    return <div>
      {this._renderDecryptingMessage()}
      {this._renderErrorMessage()}
    </div>
  }

  _renderDecryptingMessage() {
    if (this.state.decrypting) {
      return <div className="statusBox indicatorBox">
        <p>Decrypting message</p>
      </div>
    }

    return null;
  }

  _renderErrorMessage() {
    if (this.state.lastError && this.state.lastError.display) {
      return <div className="statusBox errorBox">
        <p><b>Error:</b>{this.state.lastError.message}</p>
      </div>
    }

    return null;
  }

  _onPGPStoreChange(messageId, state) {
    if (messageId === this.props.message.id) {
      console.log('received event', state);
      this.setState(state);

      // Fixed in nylas/N1@39a142ddcb80c7e1fce22dfe1e0e628272154523
      //if (state.decryptedMessage) {
      //  this.props.message.body = state.decryptedMessage;
      //}
    }
  }
}

export default MessageLoaderHeader;
