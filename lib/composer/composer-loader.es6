// Adds a button to encrypt the message body with a PGP user key from Keybase.
// User needs to specify which user to encrypt with. Script will download the
// key and present the user's Keybase profile to ensure verification.

import fs from 'fs';
import path from 'path';

import {Actions, DraftStore, QuotedHTMLTransformer, React, Utils} from 'nylas-exports';
import {Menu, GeneratedForm, Popover, RetinaImg} from 'nylas-component-kit';

//import openpgp from 'openpgp';
import kbpgp from 'kbpgp';

import {KeybaseStore} from '../keybase';

const SPAN_STYLES = "font-family:monospace,monospace;white-space:pre;";

class ComposerLoader extends React.Component {
  static displayName = 'ComposerLoader'

  static propTypes = {
    draftClientId: React.PropTypes.string.isRequired
  }

  constructor(props) {
    super(props);

    this.render = this.render.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this._hidePopover = this._hidePopover.bind(this);
    this._ensureConfigurationDirectoryExists = this._ensureConfigurationDirectoryExists.bind(this);

    this.temporaryAttachmentLocation = path.join(KeybaseStore._configurationDirPath, 'attachments');
    this._ensureConfigurationDirectoryExists();

    this.state = {
      username: ''
    }

    global.$pgpComposer = this;
  }

  render() {
    let button = <button className="btn btn-toolbar">
      PGP Encrypt
      <RetinaImg mode={RetinaImg.Mode.ContentPreserve}
                 name="toolbar-chevron.png" />
    </button>

    return <Popover ref="popover"
                    className="pgp pgp-menu-picker pull-right"
                    buttonComponent={button}>
      <form className="form col-12 m2">
        <label>Keybase Username:</label>
        <input className="field mb2 block" type="text" placeholder="(e.g. max)" onChange={this.onChange} />
        <button className="btn mb1 block" onClick={this.onSubmit}>Encrypt</button>
      </form>
    </Popover>
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
          let temporaryDir = path.join(this.temporaryAttachmentLocation, this.props.draftClientId);
          let attachmentPath = path.join(temporaryDir, 'encrypted.asc');
          return fs.mkdirAsync(temporaryDir).then(() => {
            return fs.writeFileAsync(attachmentPath, pgpMessage);
          }).then(() => {
            Actions.attachFilePath({
              path: attachmentPath,
              messageClientId: this.props.draftClientId
            });
          });
        }).then(() => {
          let body = QuotedHTMLTransformer.appendQuotedHTML(bodyHeader, draftHtml);

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
    return `This message is encrypted for <span style="${SPAN_STYLES}">${username}</span> with key fingerprint <span style="${SPAN_STYLES}">${fingerprint}</span>.`;
  }

  _importPublicKey(publicKey) {
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

  _ensureConfigurationDirectoryExists() {
    fs.access(this.temporaryAttachmentLocation, fs.F_OK, (err) => {
      if (err) {
        console.log('[PGP] Temporary attachment directory missing, creating');
        fs.mkdir(this.temporaryAttachmentLocation, (err) => {
          if (err) {
            console.error('[PGP] Temporary attachment directory creation unsuccessful', err);
          } else {
            console.log('[PGP] Temporary attachment directory creation successful');
          }
        });
      }
    });
  }
}

export default ComposerLoader;
