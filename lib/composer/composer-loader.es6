/** @babel */

import fs from 'fs';
import path from 'path';

import {Actions, DraftStore, QuotedHTMLTransformer, React, Utils} from 'nylas-exports';
import {Menu, GeneratedForm, Popover, RetinaImg} from 'nylas-component-kit';

import kbpgp from 'kbpgp';
import rimraf from 'rimraf';

import {KeybaseStore} from '../keybase';
import Logger from '../utils/Logger';
import MIMEWriter from './mime-writer';

const NO_OP = () => {};
const SPAN_STYLES = "font-family:monospace,monospace;white-space:pre;";
const rimrafPromise = Promise.promisify(rimraf);

/**
 * Adds a button to encrypt the message body with a PGP user key from Keybase.
 * User needs to specify which user to encrypt with. Script will download the
 * key and present the user's Keybase profile to ensure verification.
 */
class ComposerLoader extends React.Component {
  static displayName = 'ComposerLoader';

  static propTypes = {
    draftClientId: React.PropTypes.string.isRequired
  };

  constructor(props) {
    super(props);

    this.onClick = this.onClick.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this._ensureConfigurationDirectoryExists = this._ensureConfigurationDirectoryExists.bind(this);
    this.render = this.render.bind(this);

    this.temporaryAttachmentLocation = path.join(KeybaseStore._configurationDirPath, 'attachments');
    this._ensureConfigurationDirectoryExists();

    this.log = Logger.create(`ComposerLoader(${props.draftClientId})`);

    this.state = { username: '' };

    global.$pgpComposer = this;
  }

  onClick(e) {
    const buttonRect = React.findDOMNode(this).getBoundingClientRect();
    const popover = (
      <div className="pgp-composer">
        <div className="menu">
          <div className="header-container">
            <span>PGP Encrypt:</span>
          </div>

          <div className="content-container">
            <div className="item">
              <label>Keybase Username:</label>
              <input className="keybase-username" type="text" placeholder="(e.g. max)" onChange={this.onChange} />
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
      username: e.target.value
    });
  }

  onSubmit(e) {
    Actions.closePopover();

    let {username, fingerprint} = this.state;

    this.log.info('submit', username);
    return KeybaseStore.keybaseRemote.publicKeyForUsername(username).then(armoredKey => {
      if (!armoredKey) {
        return Promise.reject(new Error(`No public key for username ${username}`));
      }

      return this._importPublicKey(armoredKey).then(publicKey => {
        return [
          DraftStore.sessionForClientId(this.props.draftClientId),
          publicKey
        ];
      }).spread((session, publicKey) => {
        let draftHtml = session.draft().body;
        let text = QuotedHTMLTransformer.removeQuotedHTML(draftHtml);

        let fingerprint = kbpgp.util.format_fingerprint(publicKey.get_pgp_fingerprint());
        let bodyHeader = this._formatBodyHeader(username, fingerprint);

        return this._encryptMessage(text, publicKey).then(pgpMessage => {
          let temporaryDir = path.join(this.temporaryAttachmentLocation, this.props.draftClientId);
          let attachmentPath = path.join(temporaryDir, 'encrypted.asc');

          return fs.accessAsync(temporaryDir, fs.F_OK).then(() => {
            return rimrafPromise(temporaryDir);
          }, NO_OP).then(() => {
            return fs.mkdirAsync(temporaryDir);
          }).then(() => {
            return fs.writeFileAsync(attachmentPath, pgpMessage);
          }).then(() => {
            Actions.addAttachment({
              messageClientId: this.props.draftClientId,
              filePath: attachmentPath
            });
          });
        }).then(() => {
          let body = QuotedHTMLTransformer.appendQuotedHTML(bodyHeader, draftHtml);

          session.changes.add({ body });
          session.changes.commit();
        });
      }).catch(err => {
        this.log.error(err);
      });
    });
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

  _encryptMessage(text, encrypt_for) {
    let box = Promise.promisify(kbpgp.box);

    let writer = new MIMEWriter();

    writer.writePart(text, {
      type: 'text/html; charset="UTF-8"'
    });

    let msg = writer.end();

    return box({ msg, encrypt_for }).then(([ pgpMessage, pgpMessageBuffer ]) => {
      return pgpMessage;
    });
  }

  _ensureConfigurationDirectoryExists() {
    fs.access(this.temporaryAttachmentLocation, fs.F_OK, err => {
      if (err) {
        this.log.info('Temporary attachment directory missing, creating');
        fs.mkdir(this.temporaryAttachmentLocation, err => {
          if (err) {
            this.log.error('Temporary attachment directory creation unsuccessful', err);
          } else {
            this.log.info('Temporary attachment directory creation successful');
          }
        });
      }
    });
  }

  render() {
    //return <Popover ref="popover" className="pgp-composer" buttonComponent={button}>
    return (
      <button className="btn btn-toolbar" onClick={this.onClick}>
        <RetinaImg url="nylas://cypher/assets/icon-composer-encrypt@2x.png" mode={RetinaImg.Mode.ContentIsMask} />
        <RetinaImg name="icon-composer-dropdown.png" mode={RetinaImg.Mode.ContentIsMask} />
      </button>
    );
  }
}

export default ComposerLoader;
