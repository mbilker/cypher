/** @babel */

import { React, MessageStore } from 'nylas-exports';

import _ from 'lodash';
// import kbpgp from 'kbpgp';
// import PKESK from 'kbpgp/lib/openpgp/packet/sess';

import PGPStore from './flux/stores/pgp-store';
import KeybaseRemote from './keybase/keybase-integration';
// import proto from './worker/worker-protocol';
// import WorkerFrontend from './worker-frontend';

import Logger from './utils/Logger';

class KeybaseSidebar extends React.Component {
  static displayName = 'KeybaseSidebar';

  /**
   * Providing container styles tells the app how to constrain
   * the column your component is being rendered in. The min and
   * max size of the column are chosen automatically based on
   * these values.
   */
  static containerStyles = {
    order: 1,
    flexShrink: 0,
  };

  /**
   * This sidebar component listens to the PGPStore for any changes to
   * decryption of the current message. If there is a decryption operation on
   * the current message, then this component will display relevant Keybase.io
   * information if the contact has a Keybase.io account.
   */
  constructor(props) {
    super(props);

    this.proofs = this.proofs.bind(this);
    this.cryptocoins = this.cryptocoins.bind(this);
    this.onPGPStoreChange = this.onPGPStoreChange.bind(this);
    this.renderContent = this.renderContent.bind(this);
    this.render = this.render.bind(this);

    this.keybaseRemote = new KeybaseRemote();
    this.log = Logger.create('KeybaseSidebar');

    this.state = { data: null };
    this.getInitialPGPState();
  }

  componentDidMount() {
    this.unsubscribes = [];
    this.unsubscribes.push(PGPStore.listen(this.onPGPStoreChange));
  }

  componentWillUnmount() {
    for (const unsubscribe of this.unsubscribes) {
      if (unsubscribe) {
        unsubscribe();
      }
    }
  }

  getInitialPGPState() {
    const msgId = MessageStore.items()[0].id;
    const pgpData = PGPStore.getState(msgId);
    if (pgpData) {
      this.onPGPStoreChange(msgId, pgpData);
    }
  }

  proofs() {
    return _.map(this.state.data.by_presentation_group, (proofs, site) => {
      const icon = ((function selectIcon(_site) {
        switch (false) {
          case _site !== 'twitter':
            return 'twitter';
          case _site !== 'github':
            return 'github';
          case _site !== 'reddit':
            return 'reddit';
          case _site !== 'coinbase':
            return 'btc';
          case _site !== 'hackernews':
            return 'hacker-news';
          default:
            return 'globe';
        }
      })(site));

      const results = [];
      for (const proof of proofs) {
        if (proofs[1] && proofs[1].presentation_tag === 'dns' && proof.presentation_tag === 'dns') {
          break;
        }

        const className = `social-icon fa fa-${icon}`;
        const style = { marginTop: 2, minWidth: '1em' };

        results.push(
          <div className="social-profile">
            <i className={className} style={style}></i>

            <div className="social-link">
              <a href={proof.proof_url}>{proof.nametag}</a>
            </div>
          </div>
        );
      }

      return results;
    });
  }

  cryptocoins() {
    return _.map(this.state.cryptoaddress, (data, type) => {
      const icon = ((function selectIcon() {
        if (type === 'bitcoin') {
          return 'btc';
        }
        return 'question-circle';
      })());

      return data.map((address) => {
        const className = `social-icon fa fa-${icon}`;
        const style = { marginTop: 2, minWidth: '1em' };

        return (
          <div className="social-profile">
            <i className={className} style={style}></i>

            <div className="social-link">
              {address.address}
            </div>
          </div>
        );
      });
    });
  }

  onPGPStoreChange(id, state) {
    // TODO: actually use the key from the message, this is my personal keybase
    // key fingerprint to test this with consistent results
    const encrypted = ['f3ac2d1dc4be59122aceb87d69adf8aeb6c8b5d1'];

    const promises = encrypted.map((x) =>
      this.keybaseRemote.userLookup({
        key_fingerprint: [x],
        fields: ['basics', 'proofs_summary', 'cryptocurrency_addresses']
      }).then((res) => {
        this.log.info(res);
        if (res) {
          if (res.them) {
            return res.them[0];
          }
        }
      })
    );
    this.log.info(promises);

    Promise.all(promises).then((results) => {
      this.log.info(results);
      if (!results) {
        return;
      }

      const res = results[0];
      this.setState({
        data: res.proofs_summary,
        name: res.basics.username,
        profile: res.profile,
        cryptoaddress: res.cryptocurrency_addresses
      });
    });
  }

  renderPlaceholder() {
    return (
      <div className="header">
        <h2>Keybase</h2>
        <div>Loading...</div>
      </div>
    );
  }

  renderContent() {
    if (!this.state.data) {
      return this.renderPlaceholder();
    }

    const proofs = this.proofs();
    const coins = this.cryptocoins();

    this.log.info(coins);

    const href = `https://keybase.io/${this.state.name}`;
    const style = { textDecoration: 'none' };

    return (
      <div className="header">
        <h2>
          Keybase - <a href={href} style={style}>link</a>
        </h2>

        <div>
          {this.state.name}
        </div>
        <div className="social-profiles">
          {proofs}
          {coins}
        </div>
      </div>
    );
  }

  render() {
    let content = null;

    if (this.state.contact) {
      content = this.renderContent();
    } else {
      content = this.renderPlaceholder();
    }

    return (
      <div className="sidebar-keybase">
        {content}
      </div>
    );
  }
}

export default KeybaseSidebar;
