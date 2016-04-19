/** @babel */

import { React } from 'nylas-exports';
import { Flexbox } from 'nylas-component-kit';

function noop() {}

export default class SettingsField extends React.Component {
  static displayName = 'SettingsField';

  static propTypes = {
    className: React.PropTypes.string,
    inputId: React.PropTypes.string.isRequired,
    message: React.PropTypes.string.isRequired,
    type: React.PropTypes.string,
    placeholder: React.PropTypes.string,
    value: React.PropTypes.string,
    tabIndex: React.PropTypes.string,
    onChange: React.PropTypes.func.isRequired,
  };

  render() {
    const {
      className = '',
      inputId,
      message,
      type = 'text',
      placeholder,
      value,
      tabIndex = '-1',
      onChange = noop,
    } = this.props;

    return (
      <Flexbox className={className}>
        <div className="setting-name">
          <label htmlFor={inputId}>{message}:</label>
        </div>
        <div className="setting-value">
          <input
            id={inputId}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            tabIndex={tabIndex}
          />
        </div>
      </Flexbox>
    );
  }
}
