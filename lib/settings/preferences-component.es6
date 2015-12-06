import {React} from 'nylas-exports';
import {Flexbox} from 'nylas-component-kit';

import {KeybaseActions, KeybaseStore} from '../keybase';

// TODO: Branch out Keybase into own NylasStore to become more singleton-like
// Right now I am just trying to get this working and public keys from
// Keybase for other tracking users and download stored keys for decryption

class PreferencesComponent extends React.Component {
  static displayName = 'PreferencesComponent';

  constructor(props) {
    super(props);

    this.render = this.render.bind(this);
    this._renderError = this._renderError.bind(this);
    this._renderUserLoginInfo = this._renderUserLoginInfo.bind(this);
    this.onChangeUsername = this.onChangeUsername.bind(this);
    this.onChangePassphrase = this.onChangePassphrase.bind(this);
    this.loginToKeybase = this.loginToKeybase.bind(this);
    this.fetchAndVerifySigChain = this.fetchAndVerifySigChain.bind(this);

    //this.keybase = new KeybaseIntegration();
    //this.keybase.loadPreviousLogin();

    global.$pgpPref = this;

    let {
      username = '',
      uid = '',
      csrf_token = '',
      session_token = ''
    } = NylasEnv.config.get('email-pgp.keybase') || {};

    this.defaultState = this.state = {
      error: '',
      username: username,
      passphrase: (csrf_token && session_token) ? '****' : '',
      uid: uid,
      csrf_token: csrf_token,
      session_token: session_token,
      userInfo: null
    };
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
    return <div className="container-pgp-mail">
      <section>
        <h2>Keybase Login</h2>
        <div><i>Sorry, tab to next field does not work</i></div>
        {this._renderError()}
        <Flexbox className="keybase-username item">
          <div className="setting-name">
            <label htmlFor="account.username">Username/Email:</label>
          </div>
          <div className="setting-value">
            <input id="account.username" type="text" placeholder="(e.g. max)" value={this.state.username} onChange={this.onChangeUsername} />
          </div>
        </Flexbox>
        <Flexbox className="keybase-password item">
          <div className="setting-name">
            <label htmlFor="account.passphrase">Passphrase:</label>
          </div>
          <div className="setting-value">
            <input id="account.passphrase" type="password" value={this.state.passphrase} onChange={this.onChangePassphrase} />
          </div>
        </Flexbox>
        {this._renderUserLoginInfo()}
        <button className="btn" onClick={this.loginToKeybase}>Login</button>
      </section>
      <section>
        <h2>SigChain status</h2>
        <Flexbox className="keybase-sigchain item">
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
      let body = `uid: ${uid}\nsession_token: ${session_token}`;

      // Using substitution causes <span>s to be used, causes incorrect line
      // breaks
      return <pre>{body}</pre>
    }
  }

  onChangeUsername(e) {
    console.log('username');

    this.setState({
      username: e.target.value
    });
  }

  onChangePassphrase(e) {
    console.log('passphrase');

    this.setState({
      passphrase: e.target.value
    });
  }

  loginToKeybase() {
    console.log('login');

    let { username, passphrase } = this.state;
    console.log('%s %s', username, passphrase);

    this.setState(this.defaultState);

    KeybaseActions.login(username, passphrase);
  }

  fetchAndVerifySigChain() {
    let { username, uid } = this.state;
    KeybaseActions.fetchAndVerifySigChain(username, uid);
  }

  onKeybaseStore({ type, username, uid, res }) {
    if (type === 'LOGIN') {
      console.log(res);

      let { status: { name } } = res;

      if (name === 'BAD_LOGIN_PASSWORD') {
        return this.setState({
          error: 'Bad Passphrase'
        });
      } else if (name === 'BAD_LOGIN_USER_NOT_FOUND') {
        return this.setState({
          error: 'Bad Username or Email'
        });
      }

      NylasEnv.config.set('email-pgp.keybase.username', username);
      NylasEnv.config.set('email-pgp.keybase.uid', res.uid);
      NylasEnv.config.set('email-pgp.keybase.csrf_token', res.csrf_token);
      NylasEnv.config.set('email-pgp.keybase.session_token', res.session);

      this.setState({
        error: '',
        username: username,
        password: '****',
        uid: res.uid,
        csrf_token: res.csrf_token,
        session_token: res.session,
        userInfo: res.me
      });
    } else {
      console.log('listen:', username, uid, res);
    }
  }
}

export default PreferencesComponent;
