/** @babel */

import { React } from 'nylas-exports';

import KeybaseActions from '../keybase/store/keybase-actions';
import KeybaseStore from '../keybase/store/keybase-store';
import SettingsField from './settings-field';

import Logger from '../utils/Logger';

class KeybaseLoginSection extends React.Component {
  static displayName = 'KeybaseLoginSection';

  defaultState = {
    error: '',
    username: '',
    passphrase: '',
    uid: '',
    csrfToken: '',
    sessionToken: '',
    userInfo: '',
  };

  constructor(props) {
    super(props);

    this.loginToKeybase = this.loginToKeybase.bind(this);
    this.fetchAndVerifySigChain = this.fetchAndVerifySigChain.bind(this);
    this.onKeybaseStore = this.onKeybaseStore.bind(this);
    this.onChangeUsername = this.onChangeUsername.bind(this);
    this.onChangePassphrase = this.onChangePassphrase.bind(this);

    this.log = Logger.create('KeybaseLoginSection');
    this.state = this.loadPreviousLogin();
  }

  componentDidMount() {
    this.unsubscribe = KeybaseStore.listen(this.onKeybaseStore);
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  loadPreviousLogin() {
    const {
      username = '',
      uid = '',
      csrf_token: csrfToken = '',
      session_token: sessionToken = '',
    } = NylasEnv.config.get('cypher.keybase') || {};

    return {
      error: '',
      username,
      passphrase: (csrfToken && sessionToken) ? '****' : '',
      uid,
      csrfToken,
      sessionToken,
      userInfo: null,
    };
  }

  loginToKeybase() {
    const { username, passphrase } = this.state;

    if (username === '' || passphrase === '') {
      this.setState({ error: 'Please provide a username and passphrase!' });
      return;
    }

    this.log.info('Keybase Login');
    this.setState(Object.assign({}, this.defaultState, {
      username,
    }));

    KeybaseActions.login(username, passphrase);
  }

  fetchAndVerifySigChain() {
    const { username, uid } = this.state;
    KeybaseActions.fetchAndVerifySigChain(username, uid);
  }

  onKeybaseStore({ type, username, uid, res }) {
    if (type === 'LOGIN') {
      const { status: { name } } = res;

      if (name === 'BAD_LOGIN_PASSWORD') {
        return this.setState({ error: 'Bad Passphrase' });
      } else if (name === 'BAD_LOGIN_USER_NOT_FOUND') {
        return this.setState({ error: 'Bad Username or Email' });
      }

      this.setState(Object.assign({}, this.loadPreviousLogin(), {
        userInfo: res.me,
      }));
    } else {
      this.log.info(`listen: type=${type}, username=${username}, uid=${uid}, res=`, res);
      /* this.setState({
        username,
        uid
      }); */
      this.forceUpdate();
    }
  }

  onChangeUsername(e) {
    this.setState({ username: e.target.value });
  }

  onChangePassphrase(e) {
    this.setState({ passphrase: e.target.value });
  }

  renderError() {
    const { error } = this.state;

    if (error !== '') {
      return (
        <div className="pgp-message-header pgp-message-header-error">
          Error: {error}
        </div>
      );
    }
  }

  renderUserLoginInfo() {
    const { uid, sessionToken } = this.state;

    if (uid && sessionToken) {
      const body = `uid: ${uid}\nsessionToken: ${sessionToken}`;

      // Using substitution causes <span>s to be used, causes incorrect line
      // breaks
      return (
        <pre>{body}</pre>
      );
    }
  }

  render() {
    const { username, passphrase } = this.state;

    return (
      <section className="keybase-login">
        <h2>Keybase Login</h2>
        {this.renderError()}
        <SettingsField
          className="keybase-username"
          message="Username"
          inputId="account.username"
          placeholder="(e.g. max)"
          value={username}
          onChange={this.onChangeUsername}
          tabIndex="1"
        />
        <SettingsField
          className="keybase-password"
          message="Password"
          inputId="account.password"
          type="password"
          value={passphrase}
          onChange={this.onChangePassphrase}
          tabIndex="2"
        />
        {this.renderUserLoginInfo()}
        <button className="btn" onClick={this.loginToKeybase} tabIndex="3">Login</button>
      </section>
    );
  }
}

export default KeybaseLoginSection;
