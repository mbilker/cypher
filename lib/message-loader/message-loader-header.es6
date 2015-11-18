// PGP Message Loader
//
// Currently for Facebook PGP-encrypted email, this will detect that Facebook
// puts the PGP encrypted document as the second attachment. It will read the
// attachment from disk asynchrnously with background tasks

import {Utils, React} from 'nylas-exports';

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

    this.state = EmailPGPStore.getState(this.props.message.id);
  }

  componentDidMount() {
    this._storeUnlisten = EmailPGPStore.listen(this._onPGPStoreChange);

    window.loader = this;
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
    let decrypting = this.state.decrypting && this.props.message.files.length > 0;
    let displayError = this.state.lastError && this.state.lastError.display;

    if (decrypting && !this.props.message.body) {
      return this._renderDecryptingMessage();
    } else if (displayError) {
      return this._renderErrorMessage();
    } else {
      return <span />
    }
  }

  _renderDecryptingMessage() {
    return <div className="statusBox indicatorBox">
      <p>Decrypting message</p>
    </div>
  }

  _renderErrorMessage() {
    return <div className="statusBox errorBox">
      <p><b>Error:</b>{this.state.lastError.message}</p>
    </div>
  }

  _onPGPStoreChange(messageId, { decrypting, lastError }) {
    if (messageId === this.props.message.id) {
      console.log('received event', { decrypting, lastError });
      this.setState({ decrypting, lastError });
    }
  }
}

export default MessageLoaderHeader;
