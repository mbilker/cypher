// Adds a button to encrypt the message body with a PGP user key from Keybase.
// User needs to specify which user to encrypt with. Script will download the
// key and present the user's Keybase profile to ensure verification.

import {Utils, DraftStore, QuotedHTMLParser, React} from 'nylas-exports';
import {Menu, GeneratedForm, Popover, RetinaImg} from 'nylas-component-kit';

import openpgp from 'openpgp';

import KeybaseIntegration from '../keybase';

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
  }

  render() {
    let items = ['first', 'second'];
    let fieldsets = [
      {
        id: "pgp-fieldset",
        heading: "PGP Heading",
        formItems: [
          {
            row: 0,
            id: "enter-username",
            label: "Keybase Username",
            type: "text",
            placeholder: "(e.g. max)"
          }
        ]
      }
    ]
    return <Popover ref="popover"
                    className="pgp-menu-picker pull-right"
                    buttonComponent={this._renderButton()}>
      <GeneratedForm id="keybase-encrypt"
                     fieldsets={fieldsets}
                     onChange={this.onChange}
                     onSubmit={this.onSubmit} />
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
    //console.log('change', e);
    this.setState({
      username: e.fieldsets[0].formItems[0].value
    });
  }

  onSubmit(e) {
    this.refs.popover.close();

    let {username, fingerprint} = this.state;
    let keybase = new KeybaseIntegration();

    console.log('submit');
    console.log(username);

    keybase.pubKeyForUsername(username).then((armoredKey) => {
      //console.log(armoredKey);
      if (!armoredKey) {
        throw new Error("No public key for username " + username);
      }
      let publicKey = openpgp.key.readArmored(armoredKey);
      let bodyHeader = this._formatBodyHeader(username, '(put fingerprint here)');

      return DraftStore.sessionForClientId(this.props.draftClientId).then((session) => {
        let draftHtml = session.draft().body;

        return openpgp.encryptMessage(publicKey.keys, draftHtml).then((pgpMessage) => {
          let bodyPgp = this._formatBody(pgpMessage);
          let body = QuotedHTMLParser.appendQuotedHTML(bodyPgp, bodyHeader);

          console.log(body);

          session.changes.add({ body: bodyHeader });
          session.changes.add({ body });
          session.changes.commit();
        });
      });
    });
  }

  _formatBodyHeader(username, fingerprint) {
    return `This message is encrypted for <span style="${this.spanStyles}">${username}</span> with key fingerprint <span style="${this.spanStyles}">${fingerprint}</span>.`;
  }

  _formatBody(pgpMessage) {
    return `<pre style="white-space:pre;">${pgpMessage}</pre>`;
  }
}

export default ComposerLoader;
