/** @babel */

import { React } from 'nylas-exports';
import _ from 'lodash';

/**
 * Copyright (c) 2016 Nylas
 * blah blah blah GPL-3.0 licensed
 */

/**
 * This component renders input controls for a subtree of the N1 config-schema
 * and reads/writes current values using the `config` prop, which is expected to
 * be an instance of the config provided by `ConfigPropContainer`.
 *
 * The config schema follows the JSON Schema standard: http://json-schema.org/
 */
class ConfigSchemaItem extends React.Component {
  static displayName = 'ConfigSchemaItem';

  static propTypes = {
    config: React.PropTypes.object,
    configSchema: React.PropTypes.object,
    keyPath: React.PropTypes.string,
    keyName: React.PropTypes.string,
  };

  _appliesToPlatform() {
    if (!this.props.configSchema.platforms) {
      return true;
    }
    for (const platform of this.props.configSchema.platforms) {
      if (process.platform === platform) {
        return true;
      }
    }
    return false;
  }

  _onChangeChecked(event) {
    this.props.config.toggle(this.props.keyPath);
    event.target.blur();
  }

  _onChangeValue(event) {
    this.props.config.set(this.props.keyPath, event.target.value);
    event.target.blur();
  }

  render() {
    if (!this._appliesToPlatform()) {
      return false;
    }

    // In the future, we may add an option to reveal "advanced settings"
    if (this.props.configSchema.advanced) {
      return false;
    }

    if (this.props.configSchema.type === 'object') {
      return (
        <section>
          <h2>{this.props.keyName}</h2>
          {_.pairs(this.props.configSchema.properties).map(([key, value]) =>
            <ConfigSchemaItem
              key={key}
              keyName={key}
              keyPath={`${this.props.keyPath}.${key}`}
              configSchema={value}
              config={this.props.config}
            />
          )}
        </section>
      );
    } else if (this.props.configSchema.enum) {
      const { config, keyPath, configSchema: { enumLabels, title } } = this.props;
      const selectValue = config.get(keyPath);
      return (
        <div className="item">
          <label htmlFor={keyPath}>{title}:</label>
          <select onChange={this._onChangeValue} value={selectValue}>
            {_.zip(this.props.configSchema.enum, enumLabels).map(([value, label]) =>
              <option key={value} value={value}>{label}</option>
            )}
          </select>
        </div>
      );
    } else if (this.props.configSchema.type === 'boolean') {
      return (
        <div className="item">
          <input
            id={this.props.keyPath}
            type="checkbox"
            checked={this.props.config.get(this.props.keyPath)}
            onChange={this._onChangeChecked}
          />
          <label htmlFor={this.props.keyPath}>{this.props.configSchema.title}</label>
        </div>
      );
    }

    return (
      <span />
    );
  }
}

export default ConfigSchemaItem;
