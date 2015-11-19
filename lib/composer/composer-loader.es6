// Adds a button to encrypt the message body with a PGP user key from Keybase.
// User needs to specify which user to encrypt with. Script will download the
// key and present the user's Keybase profile to ensure verification.

import {Utils, DraftStore, QuotedHTMLParser, React} from 'nylas-exports';
import {Menu, GeneratedForm, Popover, RetinaImg} from 'nylas-component-kit';

class ComposerLoader extends React.Component {
  static displayName = 'ComposerLoader'

  static propTypes = {
    draftClientId: React.PropTypes.string.isRequired
  }

  state = {
    username: ''
  }

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
      <GeneratedForm id="keybase-encrypt" fieldsets={fieldsets} onChange={this.onChange} onSubmit={this.onSubmit} />
    </Popover>
  }

  _renderButton() {
    return <button className="btn btn-toolbar">
      PGP Encrypt
      <RetinaImg mode={RetinaImg.Mode.ContentPreserve} name="toolbar-chevron.png" />
    </button>
  }

  onChange(e) {
    console.log('change', e);
    this.setState({
      username: e.fieldsets[0].formItems[0].value
    });
  }

  onSubmit(e) {
    this.refs.popover.close();

    let {username, fingerprint} = this.state;

    console.log('submit');
    console.log(username);

    let session = DraftStore.sessionForClientId(this.props.draftClientId).then((session) => {
      let draftHtml = session.draft().body;
      let bodyHeader = this._formatBodyHeader(username, '3838 8d8d 88daa 8d8f (example)');
      let body = QuotedHTMLParser.appendQuotedHTML(bodyHeader, draftHtml);

      session.changes.add({ body });
      session.changes.commit();
    });
  }

  _formatBodyHeader(username, fingerprint) {
    let spanStyles = "font-family:monospace,monospace;white-space:pre;";
    return `This message is encrypted for <span style="${spanStyles}">${username}</span> with key fingerprint <span style="${spanStyles}">${fingerprint}</span>.`;
  }
}

export default ComposerLoader;
