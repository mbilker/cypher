/** @babel */
/* eslint react/sort-comp: 0 */

import fs from 'fs';
import path from 'path';

import { Actions, DraftStore, QuotedHTMLTransformer, React, ReactDOM } from 'nylas-exports';
import { RetinaImg } from 'nylas-component-kit';

import kbpgp from 'kbpgp';
import rimraf from 'rimraf';

import KeybaseStore from '../keybase/store/keybase-store';
import Logger from '../utils/Logger';
import MIMEWriter from './mime-writer';

const NO_OP = function noop() {};
const SPAN_STYLES = 'font-family:monospace,monospace;white-space:pre;';
const rimrafPromise = Promise.promisify(rimraf);

/**
 * Adds a button to encrypt the message body with a PGP user key from Keybase.
 * User needs to specify which user to encrypt with. Script will download the
 * key and present the user's Keybase profile to ensure verification.
 */
class ComposerLoader extends React.Component {
  static displayName = 'ComposerLoader';

  static propTypes = {
    draftClientId: React.PropTypes.string.isRequired,
  };

  temporaryAttachmentLocation = path.join(KeybaseStore._configurationDirPath, 'attachments');

  state = {
    username: '',
  };

  constructor(props) {
    super(props);

    this.onClick = this.onClick.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this._ensureConfigurationDirectoryExists = this._ensureConfigurationDirectoryExists.bind(this);
    this.render = this.render.bind(this);

    this.log = Logger.create(`ComposerLoader(${props.draftClientId})`);

    this._ensureConfigurationDirectoryExists();

    global.$pgpComposer = this;
  }

  onClick() {
    const buttonRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
    const popover = (
      <div className="pgp-composer">
        <div className="menu">
          <div className="header-container">
            <span>PGP Encrypt:</span>
          </div>

          <div className="content-container">
            <div className="item">
              <label>Keybase Username:</label>
              <input
                className="keybase-username"
                type="text"
                placeholder="(e.g. max)"
                onChange={this.onChange}
              />
            </div>
          </div>

          <div className="footer-container">
            <div className="divider"></div>
            <div className="submit-section">
              <button className="btn" onClick={this.onSubmit}>Encrypt</button>
            </div>
          </div>
        </div>
      </div>
    );

    Actions.openPopover(popover, { originRect: buttonRect, direction: 'up' });
  }

  onChange(e) {
    this.log.info('change', e);
    this.setState({
      username: e.target.value,
    });
  }

  onSubmit() {
    Actions.closePopover();

    const { draftClientId } = this.props;
    const { username } = this.state;

    this.log.info('submit', username);
    return KeybaseStore.keybaseRemote.publicKeyForUsername(username).then(armoredKey => {
      if (!armoredKey) {
        return Promise.reject(new Error(`No public key for username ${username}`));
      }

      return this._importPublicKey(armoredKey).then(publicKey => [
        DraftStore.sessionForClientId(draftClientId),
        publicKey,
      ]).spread((session, publicKey) => {
        const draftHtml = session.draft().body;
        const text = QuotedHTMLTransformer.removeQuotedHTML(draftHtml);

        const fingerprint = kbpgp.util.format_fingerprint(publicKey.get_pgp_fingerprint());
        const bodyHeader = this._formatBodyHeader(username, fingerprint);

        return this._encryptMessage(text, publicKey).then((pgpMessage) => {
          const temporaryDir = path.join(this.temporaryAttachmentLocation, draftClientId);
          const attachmentPath = path.join(temporaryDir, 'encrypted.asc');

          return fs.accessAsync(temporaryDir, fs.F_OK).then(() =>
            rimrafPromise(temporaryDir)
          , NO_OP).then(() =>
            fs.mkdirAsync(temporaryDir)
          ).then(() =>
            fs.writeFileAsync(attachmentPath, pgpMessage)
          ).then(() =>
            Actions.addAttachment({
              messageClientId: draftClientId,
              filePath: attachmentPath,
            })
          );
        }).then(() => {
          const body = QuotedHTMLTransformer.appendQuotedHTML(bodyHeader, draftHtml);

          session.changes.add({ body });
          session.changes.commit();
        });
      }).catch((err) => {
        this.log.error(err);
      });
    });
  }

  _formatBodyHeader(username, fingerprint) {
    const spanUser = `<span style="${SPAN_STYLES}">${username}</span>`;
    const spanFingerprint = `<span style="${SPAN_STYLES}">${fingerprint}</span>`;
    return `This message is encrypted for ${spanUser} with key fingerprint ${spanFingerprint}.`;
  }

  _importPublicKey(publicKey) {
    const importFromArmoredPgp = Promise.promisify(kbpgp.KeyManager.import_from_armored_pgp);

    return importFromArmoredPgp({
      armored: publicKey,
    }).then(([keyManager]) => keyManager);
  }

  _encryptMessage(text, encryptFor) {
    const box = Promise.promisify(kbpgp.box);

    const writer = new MIMEWriter();
    writer.writePart(text, { type: 'text/html; charset="UTF-8"' });
    const msg = writer.end();

    return box({
      msg,
      encrypt_for: encryptFor,
    }).then(([pgpMessage]) => pgpMessage);
  }

  _ensureConfigurationDirectoryExists() {
    fs.access(this.temporaryAttachmentLocation, fs.F_OK, (err1) => {
      if (err1) {
        this.log.info('Temporary attachment directory missing, creating');
        fs.mkdir(this.temporaryAttachmentLocation, (err2) => {
          if (err2) {
            this.log.error('Temporary attachment directory creation unsuccessful', err2);
          } else {
            this.log.info('Temporary attachment directory creation successful');
          }
        });
      }
    });
  }

  render() {
    return (
      <button className="btn btn-toolbar" onClick={this.onClick}>
        <RetinaImg url="nylas://cypher/assets/icon-composer-encrypt@2x.png" mode={RetinaImg.Mode.ContentIsMask} />
        <RetinaImg name="icon-composer-dropdown.png" mode={RetinaImg.Mode.ContentIsMask} />
      </button>
    );
  }
}

export default ComposerLoader;
