// PGP Message Loader
//
// Currently for Facebook PGP-encrypted email, this will detect that Facebook
// puts the PGP encrypted document as the second attachment. It will read the
// attachment from disk asynchrnously with background tasks

import fs from 'fs';
import {Utils, FileDownloadStore, MessageBodyProcessor, React} from 'nylas-exports';

import InProcessDecrypter from './in-process-decrypter';
import WorkerProcessDecrypter from './worker-process-decrypter';
import FlowError from './flow-error';

class MessageLoader extends React.Component {
  static displayName = 'MessageLoader'

  static propTypes = {
    message: React.PropTypes.object.isRequired
  }

  constructor(props) {
    super(props);

    // Holds the downloadData (if any) for all of our files. It's a hash
    // keyed by a fileId. The value is the downloadData.
    this.state = {
      decrypting: false,
      lastError: 0,
      downloads: FileDownloadStore.downloadDataForFiles(this.props.message.fileIds())
    }
  }

  // taken from
  // https://github.com/nylas/N1/blob/master/internal_packages/message-list/lib/email-frame.cjsx
  componentDidMount() {
    this._storeUnlisten = FileDownloadStore.listen(this._onDownloadStoreChange);
    this._decryptMail();
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !Utils.isEqualReact(nextProps, this.props) ||
           !Utils.isEqualReact(nextState, this.state);
  }

  render() {
    let decrypting = this.state.decrypting && this.props.message.files.length > 0
    let displayError = this.state.lastError && this.state.lastError.display

    if (decrypting && !this.props.message.body) {
      this._renderDecryptingMessage();
    } else if (displayError) {
      this._renderErrorMessage();
    } else {
      <span />
    }
  }

  _renderDecryptingMessage() {
    <div className="statusBox indicatorBox">
      <p>Decrypting message</p>
    </div>
  }

  _renderErrorMessage() {
    <div className="statusBox errorBox">
      <p><b>Error:</b>{this.state._lastError.message}</p>
    </div>
  }

  _onDownloadStoreChange() {
    console.log('_onDownloadStoreChange');
    console.log(this.props.message);
    this.setState({
      downloads: FileDownloadStore.downloadDataForFiles(this.props.message.fileIds())
    });
  }
}
