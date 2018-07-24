'use strict';

const lodash = require('lodash');
const util = require('util');
const Chalk = require('./chalk');

const ENV_DEF_DEFAULT = [
  {
    name: "PROFILE",
    type: "string",
    description: "Customized profile names, merged from right to left"
  },
  {
    name: "SANDBOX",
    type: "string",
    description: "Customized sandbox names, merged from right to left"
  },
  {
    name: "CONFIG_DIR",
    type: "string",
    description: "The home directory of configuration"
  },
  {
    name: "CONFIG_ENV",
    type: "string",
    description: "Staging name for configuration"
  },
  {
    name: "CONFIG_PROFILE_NAME",
    type: "string",
    defaultValue: "profile",
    description: "File name (without extension) of 'profile' configuration"
  },
  {
    name: "CONFIG_SANDBOX_NAME",
    type: "string",
    defaultValue: "sandbox",
    description: "File name (without extension) of 'sandbox' configuration"
  },
  {
    name: "FEATURE_DISABLED",
    type: "array",
    scope: "test",
    description: "List of features that should be disabled"
  },
  {
    name: "FEATURE_ENABLED",
    type: "array",
    aliases: ["FEATURE_LABELS"],
    scope: "test",
    description: "List of features that should be enabled"
  },
  {
    name: "FORCING_SILENT",
    type: "array",
    scope: "test",
    description: "List of package names that should be muted (server start/stop messages)"
  },
  {
    name: "FORCING_VERBOSE",
    type: "array",
    scope: "test",
    description: "List of package names that should be verbose (server start/stop messages)"
  },
  {
    name: "FATAL_ERROR_REACTION",
    type: "string",
    enum: ["exit", "exception"],
    scope: "test",
    description: "The action that should do if application encounter a fatal error"
  },
  {
    name: "SKIP_PROCESS_EXIT",
    type: "boolean",
    defaultValue: "false",
    scope: "test",
    description: "Skipping execute process.exit (used in testing environment only)"
  },
  {
    name: "TASKS",
    type: "array",
    aliases: ["TASK", "VERIFICATION_TASK", "VERIFICATION_MODE"],
    description: "The action(s) that will be executed instead of start the server"
  },
  {
    name: "UPGRADE_DISABLED",
    type: "array",
    scope: "framework",
    description: "The upgrades that should be disabled"
  },
  {
    name: "UPGRADE_ENABLED",
    type: "array",
    aliases: ["UPGRADE_LABELS"],
    scope: "framework",
    description: "The upgrades that should be enabled"
  }
]

function EnvironmentCollection(params) {
  params = params || {};

  let definition = {};
  let namespace = params.namespace || 'DEVEBOT';
  let store = { env: {} };

  function getLabel(name, scope) {
    let ns = 'DEVEBOT';
    if (scope !== 'framework') {
      ns = namespace || 'DEVEBOT';
    }
    return ns + '_' + name;
  }

  function getValue(name, scope) {
    if (scope !== 'framework' && namespace) {
      let longname = namespace + '_' + name;
      if (longname in process.env) {
        return process.env[longname];
      }
    }
    return process.env['DEVEBOT' + '_' + name];
  }

  this.define = function(descriptors) {
    if (lodash.isArray(descriptors)) {
      let defs = lodash.keyBy(descriptors, 'name');
      definition = lodash.defaults(definition, defs);
    }
    return this;
  }

  this.define(params.definition);

  this.setNamespace = function(ns) {
    namespace = ns;
    return this;
  }

  this.getEnv = function(label, defaultValue) {
    if (!lodash.isString(label)) return undefined;
    if (!(label in definition)) {
      return process.env[label] || defaultValue;
    }
    if (process.env.NODE_ENV === 'test') {
      delete store.env[label];
    }
    if (!(label in store.env)) {
      let def = definition[label] || {};
      store.env[label] = getValue(label, def.scope);
      if (!store.env[label]) {
        if (lodash.isUndefined(defaultValue)) {
          defaultValue = def.defaultValue;
        }
        if (lodash.isArray(def.aliases)) {
          lodash.forEach(def.aliases, function(alias) {
            store.env[label] = store.env[label] || getValue(alias, def.scope);
          });
        }
        store.env[label] = store.env[label] || defaultValue;
      }
      if (def.type === 'array') {
        store.env[label] = stringToArray(store.env[label]);
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
    let self = this;
    opts = opts || {};
    // get the excluded scopes
    let excl = opts.excludes || [ 'test' ];
    excl = lodash.isArray(excl) ? excl : [excl];
    // print to console or muted?
    let lines = [], muted = (opts.muted === true);
    let chalk = muted ? new Chalk({ blanked: true, themes: DEFAULT_THEMES }) : DEFAULT_CHALK;
    let printInfo = function() {
      if (muted) {
        lines.push(util.format.apply(util, arguments));
      } else {
        console.log.apply(console, arguments);
      }
    }
    // printing
    printInfo(chalk.heading1('[+] Display environment variables:'));
    lodash.forOwn(definition, function(info, label) {
      if (info && info.scope && excl.indexOf(info.scope) >= 0) return;
      let envMsg = util.format(' |> %s: %s', chalk.envName(getLabel(label, info.scope)), info.description);
      if (info && info.defaultValue != null) {
        envMsg += util.format(' (default: %s)', chalk.defaultValue(JSON.stringify(info.defaultValue)));
      }
      printInfo(envMsg);
      if (info && info.scope) {
        printInfo('    - %s: %s', chalk.envAttrName('scope'), chalk.envAttrValue(info.scope));
      }
      if (info && info.type === 'array') {
        printInfo('    - %s: (%s)', chalk.envAttrName('format'), chalk.envAttrValue('comma-separated-string'));
      }
      if (info && info.type === 'boolean') {
        printInfo('    - %s: (%s)', chalk.envAttrName('format'), chalk.envAttrValue('true/false'));
      }
      printInfo('    - %s: %s', chalk.envAttrName('current value'), chalk.currentValue(JSON.stringify(self.getEnv(label))));
    });
    return lines;
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

const DEFAULT_THEMES = {
  heading1: ['cyan', 'bold'],
  heading2: 'cyan',
  envName: ['green', 'bold'],
  envAttrName: ['grey', 'bold'],
  envAttrValue: [ 'grey' ],
  currentValue: ['blue'],
  defaultValue: ['magenta']
};

const DEFAULT_CHALK = new Chalk({
  themes: DEFAULT_THEMES
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
