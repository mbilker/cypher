/** @babel */

import { Utils, React, FocusedContactsStore, MessageStore } from 'nylas-exports';
import { RetinaImg } from 'nylas-component-kit';

import _ from 'lodash';
import kbpgp from 'kbpgp';
import PKESK from 'kbpgp/lib/openpgp/packet/sess';

import PGPStore from './flux/stores/pgp-store';
import KeybaseRemote from './keybase/keybase-integration';
import proto from './worker/worker-protocol';
import WorkerFrontend from './worker-frontend';

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
   * This sidebar component listens to the FocusedContactStore,
   * which gives us access to the Contact object of the currently
   * selected person in the conversation. If you wanted to take
   * the contact and fetch your own data, you'd want to create
   * your own store, so the flow of data would be:
   *
   * FocusedContactStore => Your Store => Your Component
   */
  constructor(props) {
    super(props);

    this.render = this.render.bind(this);
    this._proofs = this._proofs.bind(this);
    this._cryptocoins = this._cryptocoins.bind(this);
    this._renderContent = this._renderContent.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onPGPStoreChange = this._onPGPStoreChange.bind(this);

    this.state = this._getStateFromStores();
    this.state.data = null;
  }

  componentDidMount() {
    this.unsubscribes = [];
    this.unsubscribes.push(FocusedContactsStore.listen(this._onChange));
    this.unsubscribes.push(PGPStore.listen(this._onPGPStoreChange));
  }

  componentWillUnmount() {
    for (const unsubscribe in this.unsubscribes) {
      if (unsubscribe) {
        unsubscribe();
      }
    }
  }

  getMessage() {
    console.log(MessageStore.items());
    return MessageStore.items()[0];
  }

  _getStateFromStores() {
    return {
      contact: FocusedContactsStore.focusedContact()
    };
  }

  render() {
    const msg = this.getMessage();

    if (!msg || !PGPStore.shouldDecryptMessage(msg)) {
      return <span />;
    }

    if (this.state.contact) {
      content = this._renderContent();
    } else {
      content = this._renderPlaceholder();
    }

    return (
      <div className="contact-card-fullcontact">
        {content}
      </div>
    );
  }

  _proofs() {
    return _.map(this.state.data.by_presentation_group, (proofs, site) => {
      const icon = (function() {
        switch (false) {
          case site !== 'twitter':
            return 'twitter';
          case site !== 'github':
            return 'github';
          case site !== 'reddit':
            return 'reddit';
          case site !== 'hackernews':
            return 'hackernews';
          default:
            return 'globe';
        }
      })();

      let results = [];

      for (const proof in proofs) {
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

  _cryptocoins() {
    return _.map(this.state.cryptoaddress, (data, type) => {
      const icon = (function() {
        if (type === 'bitcoin') {
          return 'btc';
        }
        return 'question-circle';
      })();

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
        )
      })
    });
  }

  _renderContent() {
    /**
     * Want to include images or other static assets in your components?
     * Reference them using the nylas:// URL scheme:
     *
     * <RetinaImg
     *   url="nylas://<<package.name>>/assets/checkmark_template@2x.png"
     *   mode={RetinaImg.Mode.ContentIsMask}/>
     */
    if (!state.data) {
      return this._renderPlaceholder();
    }

    const proofs = this._proofs();
    const coins = this._cryptocoins();

    console.log(coins);

    const href = `https://keybase.io/${this.state.name}`;
    const style = { textDecoration: 'none' };

    return (
      <div className="header">
        <a href={href} style={style}>
          <h1 className="name">Keybase</h1>
        </a>

        <div className="social-profiles">
          {proofs}
          {coins}
        </div>
      </div>
    );
  }

  renderPlaceholder() {
    return (
      <div className="header">
        <h1 className="name">Keybase</h1>

        <div className="social-profiles">
          <div className="social-profile">Loading...</div>
        </div>
      </div>
    );
  }

  _onChange() {
    this.setState(this._getStateFromStores());
  }

  _onPGPStoreChange(id, state) {
    console.log('%s, %O', id, state);

    if (false) {
      const promises = encrypted.map((x) => {
        Keybase.userLookup({
          key_fingerprint: [x],
          fields: ['basics', 'proofs_summary', 'cryptocurrency_addresses']
        }).then((res) => {
          console.log(res);
          if (res) {
            if (res.them) {
              return res.them[0];
            }
          }
        });
      });
      console.log(promises);

      Promise.all(promises).then((results) => {
        console.log(results);
        /*
        results.forEach((res) =>
          this.setState({
            data: res.proofs_summary,
            name: res.basics.username,
            profile: res.profile,
            cryptoaddress: res.cryptocurrency_addresses
          });
        });
        */
      });
    }
  }
}

export default KeybaseSidebar;
