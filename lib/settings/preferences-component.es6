import {React} from 'nylas-exports';
import {Flexbox} from 'nylas-component-kit';

import KeybaseIntegration from '../keybase';

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

    this.keybase = new KeybaseIntegration();

    this.defaultState = this.state = {
      error: '',
      username: '',
      passphrase: '',
      uid: '',
      csrfToken: ''
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
            <input id="account.passphrase" type="password" onChange={this.onChangePassphrase} />
          </div>
        </Flexbox>
        <button className="btn" onClick={this.loginToKeybase}>Login</button>
        {this._renderUserLoginInfo()}
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
    let { uid, csrfToken, userInfo } = this.state;

    if (uid && csrfToken && userInfo) {
      let body = `uid: ${uid}\ncsrf_token: ${csrfToken}`;

      // Using substitution causes <span>s to be used, causes incorrect line
      // breaks
      return <pre>{body}</pre>
    }
  }

  onChangeUsername(e) {
    console.log('username');
    console.log(e.target.value);

    this.setState({
      username: e.target.value
    });
  }

  onChangePassphrase(e) {
    console.log('passphrase');
    console.log(e.target.value);

    this.setState({
      passphrase: e.target.value
    });
  }

  loginToKeybase() {
    console.log('login');

    let { username, passphrase } = this.state;
    console.log('%s %s', username, passphrase);

    this.replaceState(this.defaultState);

    this.keybase.login(username, passphrase).then((res) => {
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

      this.setState({
        error: '',
        username: username,
        password: '****',
        uid: res.uid,
        csrfToken: res.csrf_token,
        userInfo: res.me
      });
    });
  }
}

export default PreferencesComponent;
