/** @babel */

import { React } from 'nylas-exports';
import { Flexbox } from 'nylas-component-kit';

import { KeybaseStore } from '../keybase';

import KeybaseLoginSection from './keybase-login-section';

import { Logger } from '../utils/Logger';

class PreferencesComponent extends React.Component {
  static displayName = 'PreferencesComponent';

  constructor(props) {
    super(props);

    this.loginToKeybase = this.loginToKeybase.bind(this);
    this.renderSigChain = this.renderSigChain.bind(this);
    this.render = this.render.bind(this);

    this.log = Logger.create('PreferencesComponent');

    global.$pgpPref = this;
  }

  renderSigChain() {
    const sigchain = KeybaseStore.getPrimarySigChain();
    if (!sigchain) {
      return 'Not loaded yet.';
    }

    const keytype = (kid) => {
      if (kid.startsWith('0101')) {
        return 'PGP';
      } else if (kid.startsWith('0120')) {
        return 'NaCL';
      }
      return 'Unknown';
    };

    return (
      <table>
        <thead>
          <tr>
            <td>#</td>
            <td>Type</td>
            <td>Sig Key Type</td>
            <td>Fingerprint or kid</td>
          </tr>
        </thead>
        <tbody>
        {sigchain.get_links().map((link, i) =>
          <tr key={i} className="bg-green">
            <td>{link.seqno}</td>
            <td>{link.type}</td>
            <td>{keytype(link.kid)}</td>
            <td>{link.fingerprint || link.kid}</td>
          </tr>
        )}
        </tbody>
      </table>
    );
  }

  render() {
    return (
      <div className="container-pgp-mail">
        <KeybaseLoginSection />
        <section>
          <h2>SigChain Status</h2>
          <Flexbox className="keybase-sigchain">
            {this.renderSigChain()}
          </Flexbox>
        </section>
      </div>
    );
  }
}

export default PreferencesComponent;
