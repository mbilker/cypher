import { React } from 'nylas-exports';

import KeybaseLoginSection from './keybase-login-section';
import SigChainSection from './sig-chain-section';

// import { Logger } from '../utils/Logger';

class PreferencesComponent extends React.Component {
  static displayName = 'PreferencesComponent';

  constructor(props) {
    super(props);

    this.render = this.render.bind(this);

    // this.log = Logger.create('PreferencesComponent');

    global.$pgpPref = this;
  }

  render() {
    return (
      <div className="container-pgp-mail">
        <KeybaseLoginSection ref="keybase" />
        <SigChainSection ref="sigchain" />
      </div>
    );
  }
}

export default PreferencesComponent;
