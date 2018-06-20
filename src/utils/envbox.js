'use strict';

const lodash = require('lodash');
const util = require('util');
const Chalk = require('./chalk');

const ENV_DEF_DEFAULT = [
  {
    name: "DEVEBOT_PROFILE",
    type: "string",
    description: "Customized profile names, merged from right to left"
  },
  {
    name: "DEVEBOT_SANDBOX",
    type: "string",
    description: "Customized sandbox names, merged from right to left"
  },
  {
    name: "DEVEBOT_CONFIG_DIR",
    type: "string",
    description: "The home directory of configuration"
  },
  {
    name: "DEVEBOT_CONFIG_ENV",
    type: "string",
    description: "Staging name for configuration"
  },
  {
    name: "DEVEBOT_CONFIG_PROFILE_NAME",
    type: "string",
    defaultValue: "profile",
    description: "File name (without extension) of 'profile' configuration"
  },
  {
    name: "DEVEBOT_CONFIG_SANDBOX_NAME",
    type: "string",
    defaultValue: "sandbox",
    description: "File name (without extension) of 'sandbox' configuration"
  },
  {
    name: "DEVEBOT_DEFAULT_SCOPE",
    type: "string",
    defaultValue: "devebot",
    scope: "test",
    description: "Default scope that used as npm debug's namespace name"
  },
  {
    name: "DEVEBOT_FEATURE_DISABLED",
    type: "array",
    scope: "test",
    description: "List of features that should be disabled"
  },
  {
    name: "DEVEBOT_FEATURE_ENABLED",
    type: "array",
    aliases: ["DEVEBOT_FEATURE_LABELS"],
    scope: "test",
    description: "List of features that should be enabled"
  },
  {
    name: "DEVEBOT_FORCING_SILENT",
    type: "array",
    scope: "test",
    description: "List of package names that should be muted (server start/stop messages)"
  },
  {
    name: "DEVEBOT_FORCING_VERBOSE",
    type: "array",
    scope: "test",
    description: "List of package names that should be verbose (server start/stop messages)"
  },
  {
    name: "DEVEBOT_FATAL_ERROR_REACTION",
    type: "string",
    enum: ["exit", "exception"],
    scope: "test",
    description: "The action that should do if application encounter a fatal error"
  },
  {
    name: "DEVEBOT_SKIP_PROCESS_EXIT",
    type: "boolean",
    defaultValue: "false",
    scope: "test",
    description: "Skipping execute process.exit (used in testing environment only)"
  },
  {
    name: "DEVEBOT_TASKS",
    type: "array",
    aliases: ["DEVEBOT_TASK", "DEVEBOT_VERIFICATION_TASK", "DEVEBOT_VERIFICATION_MODE"],
    description: "The action(s) that will be executed instead of start the server"
  }
]

function EnvironmentCollection(params) {
  params = params || {};

  let definition = lodash.keyBy(params.definition || [], 'name');
  let namespace = params.namespace || 'DEVEBOT';
  let store = { env: {} };

  this.getEnv = function(label, defaultValue) {
    if (!lodash.isString(label)) return undefined;
    if (!lodash.startsWith(label, namespace)) {
      return process.env[label];
    }
    if (process.env.NODE_ENV === 'test') {
      delete store.env[label];
    }
    if (!(label in store.env)) {
      store.env[label] = process.env[label];
      if (definition[label]) {
        if (lodash.isUndefined(defaultValue)) {
          defaultValue = definition[label].defaultValue;
        }
        if (lodash.isArray(definition[label].aliases)) {
          lodash.forEach(definition[label].aliases, function(alias) {
            store.env[label] = store.env[label] || process.env[alias];
          });
        }
        store.env[label] = store.env[label] || defaultValue;
        if (definition[label].type === 'array') {
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

  this.printEnvList = function(opts) {
    opts = opts || {};
    let excl = opts.excludes || [ 'test' ];
    excl = lodash.isArray(excl) ? excl : [excl];
    console.log(chalk.heading1('[+] Display environment variables:'));
    lodash.forOwn(definition, function(info, label) {
      if (info && info.scope && excl.indexOf(info.scope) >= 0) return;
      let envMsg = util.format(' |> %s: %s', chalk.envName(label), info.description);
      if (info && info.defaultValue != null) {
        envMsg += util.format(' (default: %s)', chalk.defaultValue(JSON.stringify(info.defaultValue)));
      }
      console.log(envMsg);
      if (info && info.scope) {
        console.log('    - %s: %s', chalk.envAttrName('scope'), chalk.envAttrValue(info.scope));
      }
      if (info && info.type === 'array') {
        console.log('    - %s: (%s)', chalk.envAttrName('format'), chalk.envAttrValue('comma-separated-string'));
      }
      if (info && info.type === 'boolean') {
        console.log('    - %s: (%s)', chalk.envAttrName('format'), chalk.envAttrValue('true/false'));
      }
      console.log('    - %s: %s', chalk.envAttrName('current value'), chalk.currentValue(JSON.stringify(store.env[label])));
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

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ color chalks

let chalk = new Chalk({
  themes: {
    heading1: ['cyan', 'bold'],
    heading2: 'cyan',
    envName: ['green', 'bold'],
    envAttrName: ['grey', 'bold'],
    envAttrValue: [ 'grey' ],
    currentValue: ['blue'],
    defaultValue: ['magenta']
  }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ default instance

let privateEnvbox;

Object.defineProperty(EnvironmentCollection, 'instance', {
  get: function() {
    return (privateEnvbox = privateEnvbox || new EnvironmentCollection({
      definition: ENV_DEF_DEFAULT
    }));
  },
  set: function(value) {}
});

module.exports = EnvironmentCollection;
