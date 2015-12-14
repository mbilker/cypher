// Adds a button to encrypt the message body with a PGP user key from Keybase.
// User needs to specify which user to encrypt with. Script will download the
// key and present the user's Keybase profile to ensure verification.

import {Utils, DraftStore, QuotedHTMLTransformer, React} from 'nylas-exports';
import {Menu, GeneratedForm, Popover, RetinaImg} from 'nylas-component-kit';

//import openpgp from 'openpgp';
import kbpgp from 'kbpgp';

import {KeybaseStore} from '../keybase';

class ComposerLoader extends React.Component {
  static displayName = 'ComposerLoader'

  static propTypes = {
    draftClientId: React.PropTypes.string.isRequired
  }

  state = {
    username: ''
  }

  spanStyles = "font-family:monospace,monospace;white-space:pre;";

  constructor(props) {
    super(props);

    this.render = this.render.bind(this);
    this._renderButton = this._renderButton.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this._hidePopover = this._hidePopover.bind(this);
  }

  render() {
    return <Popover ref="popover"
                    className="pgp-menu-picker pull-right"
                    buttonComponent={this._renderButton()}>
      <form className="pgp form">
        <label>Keybase Username:</label>
        <input className="field mb1 block" type="text" placeholder="(e.g. max)" onChange={this.onChange} />
        <button className="btn btn-primary block" onClick={this.onSubmit}>Encrypt</button>
      </form>
    </Popover>
  }

  _renderButton() {
    return <button className="btn btn-toolbar">
      PGP Encrypt
      <RetinaImg mode={RetinaImg.Mode.ContentPreserve}
                 name="toolbar-chevron.png" />
    </button>
  }

  onChange(e) {
    console.log('change', e);
    this.setState({
      username: e.target.value
    });
  }

  onSubmit(e) {
    this._hidePopover();

    let {username, fingerprint} = this.state;

    console.log('submit');
    console.log(username);

    return KeybaseStore.keybaseRemote.publicKeyForUsername(username).then((armoredKey) => {
      if (!armoredKey) {
        throw new Error("No public key for username " + username);
      }

      return this._importPublicKey(armoredKey).then((publicKey) => {
        return [
          DraftStore.sessionForClientId(this.props.draftClientId),
          publicKey
        ];
      }).spread((session, publicKey) => {
        let draftHtml = session.draft().body;
        let text = QuotedHTMLTransformer.removeQuotedHTML(draftHtml);

        let fingerprint = kbpgp.util.format_fingerprint(publicKey.get_pgp_fingerprint());
        let bodyHeader = this._formatBodyHeader(username, fingerprint);

        return this._encryptMessage(text, publicKey).then((pgpMessage) => {
          let bodyPgp = this._formatBody(pgpMessage);
          let body = QuotedHTMLTransformer.appendQuotedHTML(bodyHeader + bodyPgp, draftHtml);

          console.log(body);

          session.changes.add({ body });
          session.changes.commit();
        });
      }).catch((err) => {
        console.log(err);
      });
    });
  }

  _hidePopover() {
    this.refs.popover.close();
  }

  _formatBodyHeader(username, fingerprint) {
    return `This message is encrypted for <span style="${this.spanStyles}">${username}</span> with key fingerprint <span style="${this.spanStyles}">${fingerprint}</span>.`;
  }

  _formatBody(pgpMessage) {
    return `<pre style="white-space:pre;">${pgpMessage}</pre>`;
  }

  _importPublicKey(publicKey) {
    //return new Promise((resolve) => {
    //  resolve(openpgp.key.readArmored(publicKey));
    //});

    let import_from_armored_pgp = Promise.promisify(kbpgp.KeyManager.import_from_armored_pgp);

    return import_from_armored_pgp({
      armored: publicKey
    }).then(([ keyManager, warnings ]) => {
      return keyManager;
    });
  }

  _encryptMessage(msg, publicKey) {
    let box = Promise.promisify(kbpgp.box);

    return box({
      msg: msg,
      encrypt_for: publicKey
    }).then(([ pgpMessage, pgpMessageBuffer ]) => {
      return pgpMessage;
    });
  }
}

export default ComposerLoader;
