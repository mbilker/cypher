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
const ConfigSchemaItem = (props) => {
  const _appliesToPlatform = () => {
    if (!props.configSchema.platforms) {
      return true;
    }
    for (const platform of props.configSchema.platforms) {
      if (process.platform === platform) {
        return true;
      }
    }
    return false;
  };

  const _onChangeChecked = (event) => {
    props.config.toggle(props.keyPath);
    event.target.blur();
  };

  const _onChangeValue = (event) => {
    props.config.set(props.keyPath, event.target.value);
    event.target.blur();
  };

  // In the future, we may add an option to reveal "advanced settings"
  if (!_appliesToPlatform() || props.configSchema.advanced) {
    return false;
  } else if (props.configSchema.type === 'object') {
    return (
      <section>
        <h2>{props.keyName}</h2>
        {_.pairs(props.configSchema.properties).map(([key, value]) =>
          <ConfigSchemaItem
            key={key}
            keyName={key}
            keyPath={`${props.keyPath}.${key}`}
            configSchema={value}
            config={props.config}
          />
        )}
      </section>
    );
  } else if (props.configSchema.enum) {
    const { config, keyPath, configSchema: { enumLabels, title } } = props;
    const selectValue = config.get(keyPath);
    return (
      <div className="item">
        <label htmlFor={keyPath}>{title}:</label>
        <select onChange={_onChangeValue} value={selectValue}>
          {_.zip(props.configSchema.enum, enumLabels).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>
          )}
        </select>
      </div>
    );
  } else if (props.configSchema.type === 'boolean') {
    return (
      <div className="item">
        <input
          id={props.keyPath}
          type="checkbox"
          checked={props.config.get(props.keyPath)}
          onChange={_onChangeChecked}
        />
        <label htmlFor={props.keyPath}>{props.configSchema.title}</label>
      </div>
    );
  }

  return (
    <span />
  );
};

ConfigSchemaItem.displayName = 'ConfigSchemaItem';
ConfigSchemaItem.propTypes = {
  config: React.PropTypes.object,
  configSchema: React.PropTypes.object,
  keyPath: React.PropTypes.string,
  keyName: React.PropTypes.string,
};

export default ConfigSchemaItem;
