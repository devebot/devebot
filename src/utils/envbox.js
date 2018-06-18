'use strict';

const lodash = require('lodash');
const util = require('util');

const envDefinition = {
  DEVEBOT_PROFILE: {
    type: "string",
    description: "Customized profile names, merged from right to left"
  },
  DEVEBOT_SANDBOX: {
    type: "string",
    description: "Customized sandbox names, merged from right to left"
  },
  DEVEBOT_CONFIG_DIR: {
    type: "string",
    description: "The home directory of configuration"
  },
  DEVEBOT_CONFIG_ENV: {
    type: "string",
    description: "Staging name for configuration"
  },
  DEVEBOT_CONFIG_PROFILE_NAME: {
    type: "string",
    defaultValue: "profile",
    description: "File name (without extension) of 'profile' configuration"
  },
  DEVEBOT_CONFIG_SANDBOX_NAME: {
    type: "string",
    defaultValue: "sandbox",
    description: "File name (without extension) of 'sandbox' configuration"
  },
  DEVEBOT_DEFAULT_SCOPE: {
    type: "string",
    defaultValue: "devebot",
    description: "Default scope that used as npm debug's namespace name"
  },
  DEVEBOT_FEATURE_DISABLED: {
    type: "array",
    description: "List of features that should be disabled"
  },
  DEVEBOT_FEATURE_ENABLED: {
    type: "array",
    aliases: ["DEVEBOT_FEATURE_LABELS"],
    description: "List of features that should be enabled"
  },
  DEVEBOT_FORCING_SILENT: {
    type: "array",
    description: "List of package names that should be muted (server start/stop messages)"
  },
  DEVEBOT_FORCING_VERBOSE: {
    type: "array",
    description: "List of package names that should be verbose (server start/stop messages)"
  },
  DEVEBOT_FATAL_ERROR_REACTION: {
    type: "string",
    enum: ["exit", "exception"],
    description: "The action that should do if application encounter a fatal error"
  },
  DEVEBOT_SKIP_PROCESS_EXIT: {
    type: "boolean",
    defaultValue: "false",
    description: "Skipping execute process.exit (used in testing environment only)"
  },
  DEVEBOT_TASKS: {
    type: "array",
    aliases: ["DEVEBOT_VERIFICATION_TASK", "DEVEBOT_VERIFICATION_MODE"],
    description: "The action(s) that will be executed instead of start the server"
  }
}

function EnvironmentCollection() {

  let store = { env: {} };

  this.getEnv = function(label, defaultValue) {
    if (!lodash.isString(label)) return undefined;
    if (!lodash.startsWith(label, 'DEVEBOT')) {
      return process.env[label];
    }
    if (process.env.NODE_ENV === 'test') {
      delete store.env[label];
    }
    if (!(label in store.env)) {
      store.env[label] = process.env[label];
      if (envDefinition[label]) {
        if (lodash.isUndefined(defaultValue)) {
          defaultValue = envDefinition[label].defaultValue;
        }
        if (lodash.isArray(envDefinition[label].aliases)) {
          lodash.forEach(envDefinition[label].aliases, function(alias) {
            store.env[label] = store.env[label] || process.env[alias];
          });
        }
        store.env[label] = store.env[label] || defaultValue;
        if (envDefinition[label].type === 'array') {
          store.env[label] = stringToArray(store.env[label]);
        }
      } else {
        store.env[label] = store.env[label] || defaultValue;
      }
    }
    return store.env[label];
  }

  this.setEnv = function(label, value) {
    if (lodash.isString(label)) {
      store.env[label] = value;
    }
    return this;
  }

  this.reset = function() {
    for(let key in store.env) {
      delete store.env[key];
    }
    return this;
  }

  this.printEnvList = function() {
    console.log('[+] Display environment variables:');
    lodash.forOwn(envDefinition, function(info, label) {
      let envMsg = util.format(' => %s: %s', label, info.description);;
      if (info && info.defaultValue != null) {
        envMsg += util.format(' (default: %s)', JSON.stringify(info.defaultValue));
      }
      console.log(envMsg);
      if (info && info.type === 'array') {
        console.log('    - format: (comma-separated-string)');
      }
      if (info && info.type === 'boolean') {
        console.log('    - format: (true/false)');
      }
      console.log('    - current value: %s', JSON.stringify(store.env[label]));
    });
  }
}

function stringToArray(labels) {
  labels = labels || '';
  return labels.split(',').map(function(item) {
    return item.trim();
  }).filter(function(item) {
    return item.length > 0;
  });
}

EnvironmentCollection.prototype.stringToArray = stringToArray;

module.exports = new EnvironmentCollection();
