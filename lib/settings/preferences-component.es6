import {React} from 'nylas-exports';

class PreferencesComponent extends React.Component {
  static displayName = 'PreferencesComponent';

  constructor(props) {
    super(props);

    this.onChangeUsername = this.onChangeUsername.bind(this);
  }

  render() {
    return <div className="container-pgp-mail">
      <section>
        <h2>PGP Mail</h2>
        <div className="item">
          <label htmlFor="settings.username">Username:</label>
          <input id="settings.username" placeholder="(e.g. max)" onChange={this.onChangeUsername} />
        </div>
      </section>
    </div>
  }

  onChangeUsername(e) {
    console.log('change');
    console.log(e.target.value);
  }
}

export default PreferencesComponent;
