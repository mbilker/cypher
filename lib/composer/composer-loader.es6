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
    this.onSelect = this.onSelect.bind(this);
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
      //<FormItem id="j32ljlralksdf" type="text" placeholder="keybase username" value={this.state.value} label="PGP" onChange={this.handleChange} />
      //<Menu items={items}
      //      itemKey={(item) => {return item}}
      //      itemContent={(item) => {return item}}
      //      onSelect={this.onSelect} />
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

    console.log('submit');
    console.log(this.state.username);

    let session = DraftStore.sessionForClientId(this.props.draftClientId).then((session) => {
      let draftHtml = session.draft().body;
      let body = QuotedHTMLParser.appendQuotedHTML(`<pre style="white-sapce:pre">${this.state.username}</pre>`, draftHtml);

      session.changes.add({ body });
      session.changes.commit();
    });
  }

  onSelect(item) {
    console.log(item);
    let test = '-----BEGIN PGP MESSAGE-----\nVersion: GnuPG v2\n\nhQIMAxMSSYOQhLOQARAAnzad31etKn7w86qoExTgthcjQyOBRB4/cDP6s9KVbmVY\nfgY8z6Ny8W4EsqznNWkaiFjb7+sjzetPY+T4lOqYp3YY4xR83LbXQ+IVmpM4aMGl\nr+QMW8lo0YUV2xxYuoSfL+zXXUNVOL7J0EnY8TmbP/VPcakgeffhN/yVk+KTnkTL\nAqNIDFZIXiCZuz3MkLtMwYWKVXg0p+ZRhBBc7iTL4HhGUboPjTl1xOGp/Mb+lPMS\nzN5YBLdNf3zOI6AtHxpWLb8pd8kQ3nyc4viknc/NkX36htdUfvnr7GsYGlOAugnN\n74NhtXtQ17PCZAW6z8GOKfdMzFqMXWcYQwrNH7tlmAEpkdEugBbP57FhsUjFoCXW\no8/3cg2EBVExNYWFf8uqNnbpx4S8CruAsOkJCx2rj9kBr4vOjoH+0JUBE09CwFxr\nVlPyhmV90FnFe4O9ezpR1RIniwRfa9ow8Zo60bs5U3ieN5n8DWROgaUVhLCMU2KT\nkevz9hESOqcrP/N46rClkFLspieBN9BTP90/Gx8VaPfhSfClGkuQa5aJNlZmwRUa\nrjtZDaltTVQUqlR43LHK2n33dILishQQdwBdklO1OPRVPEOXQwnS5VOZkzONQDsk\n9n+97YwvuMzGNtDilWRFQvTxSrlHGjenFrAhaNgU18snPQKYN4EOwzz7zF9Wd/vS\nTgFlkN8qp0XidRE9+vIXFR341De+G54a9f506pF178iPyBii6VP4vSQOpJjm0R0O\n6IHjPuNQB10nPJBOD/1885m569BmpvBz1IzJio1vmA==\n=BYuj\n-----END PGP MESSAGE-----\n';
    let session = DraftStore.sessionForClientId(this.props.draftClientId).then((session) => {
      console.log('got draft session to work with', session);
      let draftHtml = session.draft().body;
      let body = QuotedHTMLParser.appendQuotedHTML(`<pre style="white-space:pre">${test}</pre>`, draftHtml);

      session.changes.add({ body });
      session.changes.commit();
    });
  }
}

export default ComposerLoader;
