/** @babel */

import { React } from 'nylas-exports';
import { Flexbox } from 'nylas-component-kit';

import KeybaseStore from '../keybase/store/keybase-store';

class SigChainSection extends React.Component {
  constructor(props) {
    super(props);

    this.getStateFromStores = this.getStateFromStores.bind(this);
    this.setStateFromStores = this.setStateFromStores.bind(this);
    this.renderSigChain = this.renderSigChain.bind(this);
    this.render = this.render.bind(this);

    this.state = this.getStateFromStores();
  }

  componentDidMount() {
    this.unsubscribe = KeybaseStore.listen(this.setStateFromStores);
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  getStateFromStores() {
    return {
      sigchain: KeybaseStore.getPrimarySigChain(),
    };
  }

  setStateFromStores() {
    this.setState(this.getStateFromStores());
  }

  renderSigChain() {
    const { sigchain } = this.state;
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
      <table className="sigchain-table">
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
      <section className="keybase-sigchain">
        <h2>SigChain Status</h2>
        <Flexbox>
          {this.renderSigChain()}
        </Flexbox>
      </section>
    );
  }
}

export default SigChainSection;
