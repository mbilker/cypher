import {React} from 'nylas-exports';
import {Flexbox} from 'nylas-component-kit';

import {KeybaseActions, KeybaseStore} from '../keybase';

class PreferencesComponent extends React.Component {
  static displayName = 'PreferencesComponent';

  constructor(props) {
    super(props);

    this.render = this.render.bind(this);
    this._renderError = this._renderError.bind(this);
    this._renderUserLoginInfo = this._renderUserLoginInfo.bind(this);
    this._renderSigChain = this._renderSigChain.bind(this);
    this.onChangeUsername = this.onChangeUsername.bind(this);
    this.onChangePassphrase = this.onChangePassphrase.bind(this);
    this.loadPreviousLogin = this.loadPreviousLogin.bind(this);
    this.loginToKeybase = this.loginToKeybase.bind(this);
    this.fetchAndVerifySigChain = this.fetchAndVerifySigChain.bind(this);
    this.onKeybaseStore = this.onKeybaseStore.bind(this);

    //this.keybase = new KeybaseIntegration();
    //this.keybase.loadPreviousLogin();

    global.$pgpPref = this;

    this.defaultState = this.state = {
      error: '',
      username: '',
      passphrase: '',
      uid: '',
      csrf_token: '',
      session_token: '',
      userInfo: ''
    };

    this.state = this.loadPreviousLogin();
  }

  componentDidMount() {
    this.unsubscribe = KeybaseStore.listen(this.onKeybaseStore);
  }

  componentDidUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  render() {
    return <div className="pgp container-pgp-mail">
      <section>
        <h2>Keybase Login</h2>
        {this._renderError()}
        <Flexbox className="keybase-username item">
          <div className="setting-name">
            <label htmlFor="account.username">Username/Email:</label>
          </div>
          <div className="setting-value">
            <input id="account.username" type="text" placeholder="(e.g. max)" value={this.state.username} onChange={this.onChangeUsername} tabIndex="1" />
          </div>
        </Flexbox>
        <Flexbox className="keybase-password item">
          <div className="setting-name">
            <label htmlFor="account.passphrase">Passphrase:</label>
          </div>
          <div className="setting-value">
            <input id="account.passphrase" type="password" value={this.state.passphrase} onChange={this.onChangePassphrase} tabIndex="2" />
          </div>
        </Flexbox>
        {this._renderUserLoginInfo()}
        <button className="btn" onClick={this.loginToKeybase} tabIndex="3" >Login</button>
      </section>
      <section>
        <h2>SigChain Status</h2>
        <Flexbox className="keybase-sigchain item">
          {this._renderSigChain()}
        </Flexbox>
      </section>
    </div>
  }

  _renderError() {
    if (this.state.error !== '') {
      return <div className="statusBox errorBox">
        Error: {this.state.error}
      </div>
    }
  }

  _renderUserLoginInfo() {
    let { uid, session_token } = this.state;

    if (uid && session_token) {
      const body = `uid: ${uid}\nsession_token: ${session_token}`;

      // Using substitution causes <span>s to be used, causes incorrect line
      // breaks
      return <pre>{body}</pre>
    }
  }

  _renderSigChain() {
    let sigchain = KeybaseStore.getPrimarySigChain();
    if (!sigchain) {
      return "Not loaded yet.";
    }

    let keytype = (kid) => {
      if (kid.startsWith('0101')) {
        return 'PGP';
      } else if (kid.startsWith('0120')) {
        return 'NaCL';
      } else {
        return 'Unknown';
      }
    }

    return <table>
      <thead>
        <tr>
          <td>#</td>
          <td>Type</td>
          <td>Sig Key Type</td>
          <td>Fingerprint or kid</td>
        </tr>
      </thead>
      <tbody>
      {sigchain.get_links().map((link, i) => {
        return <tr key={i} className="bg-green">
          <td>{link.seqno}</td>
          <td>{link.type}</td>
          <td>{keytype(link.kid)}</td>
          <td>{link.fingerprint || link.kid}</td>
        </tr>;
      })}
      </tbody>
    </table>
  }

  onChangeUsername(e) {
    //console.log('username');

    this.setState({
      username: e.target.value
    });
  }

  onChangePassphrase(e) {
    //console.log('passphrase');

    this.setState({
      passphrase: e.target.value
    });
  }

  loadPreviousLogin() {
    let {
      username =  '',
      uid = '',
      csrf_token = '',
      session_token = ''
    } = NylasEnv.config.get('cypher.keybase') || {};

    return {
      error: '',
      username: username,
      passphrase: (csrf_token && session_token) ? '****' : '',
      uid: uid,
      csrf_token: csrf_token,
      session_token: session_token,
      userInfo: null
    };
  }

  loginToKeybase() {
    let { username, passphrase } = this.state;
    if (username === '' || passphrase === '') {
      this.setState({
        error: 'Please provide a username and passphrase!'
      });
      return;
    }
    console.log('[PGP] Keybase Login');

    //console.log('%s %s', username, passphrase);

    this.setState(Object.assign({}, this.defaultState, {
      username
    }));

    KeybaseActions.login(username, passphrase);
  }

  fetchAndVerifySigChain() {
    let { username, uid } = this.state;
    KeybaseActions.fetchAndVerifySigChain(username, uid);
  }

  onKeybaseStore({ type, username, uid, res }) {
    if (type === 'LOGIN') {
      let { status: { name } } = res;

      if (name === 'BAD_LOGIN_PASSWORD') {
        return this.setState({ error: 'Bad Passphrase' });
      } else if (name === 'BAD_LOGIN_USER_NOT_FOUND') {
        return this.setState({ error: 'Bad Username or Email' });
      }

      this.setState(Object.assign({}, this.loadPreviousLogin(), {
        userInfo: res.me
      }));
    } else {
      console.log('listen: type=%s, username=%s, uid=%s, res=', type, username, uid, res);
      /* this.setState({
        username,
        uid
      }); */
      this.forceUpdate();
    }
  }
}

export default PreferencesComponent;
