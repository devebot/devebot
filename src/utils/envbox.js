'use strict';

const lodash = require('lodash');
const util = require('util');
const Chalk = require('./chalk');

const ENV_DEF_DEFAULT = [
  {
    name: "TASKS",
    type: "array",
    aliases: ["TASK", "ACTIONS", "ACTION"],
    description: "The action(s) that will be executed instead of start the server"
  },
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
    name: "CONFIG_PROFILE_ALIASES",
    type: "array",
    defaultValue: [],
    description: "Aliases of the file name prefix of the [profile] configuration"
  },
  {
    name: "CONFIG_SANDBOX_ALIASES",
    type: "array",
    defaultValue: [],
    description: "Aliases of the file name prefix of the [sandbox] configuration"
  },
  {
    name: "FEATURE_DISABLED",
    type: "array",
    description: "List of features that should be disabled"
  },
  {
    name: "FEATURE_ENABLED",
    type: "array",
    aliases: ["FEATURE_LABELS"],
    description: "List of features that should be enabled"
  },
  {
    name: "ENV",
    type: "string",
    description: "An alternative to NODE_ENV for application"
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
    defaultValue: false,
    scope: "test",
    description: "Skipping execute process.exit (used in testing environment only)"
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
  },
  {
    name: "DEFAULT_SCOPE",
    type: "string",
    defaultValue: "devebot",
    scope: "framework",
    description: "Default scope as debug's namespace"
  },
  {
    name: "STACK_TRACE_LIMIT",
    type: "number",
    defaultValue: Error.stackTraceLimit,
    scope: "framework",
    description: "The number of stack frames collected by a stack trace"
  },
  {
    name: "BABEL_ENV",
    type: "string",
    scope: "framework",
    description: "An alternative to BABEL_ENV for npm build scripts"
  }
]

function EnvironmentCollection(params={}) {
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

  this.setNamespace = function(ns, opts) {
    namespace = ns;
    opts = opts || {};
    if (opts.occupyValues) {
      for(let envKey in definition) {
        let info = definition[envKey];
        this.getEnv(envKey);
        let envName = getLabel(envKey);
        if (envName in process.env) {
          if (opts.ownershipLabel) {
            process.env[envName] = opts.ownershipLabel;
          } else {
            delete process.env[envName];
          }
        }
      }
    }
    return this;
  }

  this.getEnvNames = function() {
    return lodash.keys(definition);
  }

  this.getEnv = function(label, defaultValue) {
    if (!lodash.isString(label)) return undefined;
    if (!(label in definition)) {
      return process.env[label] || defaultValue;
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

  this.setEnv = function(envName, value) {
    if (lodash.isString(envName)) {
      store.env[envName] = value;
    }
    return this;
  }

  this.getAcceptedValues = function(envName) {
    let def = definition[envName];
    if (lodash.isObject(def)) {
      return def.enum || null;
    }
    return undefined;
  }

  this.setAcceptedValues = function(envName, acceptedValues) {
    let def = definition[envName];
    if (lodash.isObject(def)) {
      def.enum = acceptedValues;
    }
    return this;
  }

  this.clearCache = function(keys) {
    keys = arrayify(keys);
    for(let key in store.env) {
      if (keys.length === 0 || keys.indexOf(key) >= 0) {
        delete store.env[key];
      }
    }
    return this;
  }

  this.printEnvList = function(opts) {
    let self = this;
    opts = opts || {};
    // get the excluded scopes
    let excl = arrayify(opts.excludes || [ 'framework', 'test' ]);
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
    printInfo(chalk.heading1('[+] Environment variables:'));
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
      if (info && info.enum) {
        printInfo('    - %s: %s', chalk.envAttrName('accepted values'), chalk.envAttrValue(JSON.stringify(info.enum)));
      }
      printInfo('    - %s: %s', chalk.envAttrName('current value'), chalk.currentValue(JSON.stringify(self.getEnv(label))));
    });
    return lines;
  }
}

function arrayify(val) {
  if (val === null || val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

function stringToArray(labels) {
  labels = labels || '';
  if (lodash.isString(labels)) {
    return labels.split(',').map(function(item) {
      return item.trim();
    }).filter(function(item) {
      return item.length > 0;
    });
  }
  return labels;
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

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ default constructor & instance property

let privateEnvbox;

Object.defineProperty(EnvironmentCollection, 'instance', {
  get: function() {
    return (privateEnvbox = privateEnvbox || new EnvironmentCollection({
      definition: ENV_DEF_DEFAULT
    }));
  },
  set: function(value) {}
});

// Deprecated
// module.exports = EnvironmentCollection;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ default instance

const defaultInstance = new EnvironmentCollection({
  definition: ENV_DEF_DEFAULT
});

Object.defineProperty(defaultInstance, 'new', {
  get: function() {
    return function(kwargs) {
      return new EnvironmentCollection(kwargs);
    };
  },
  set: function(value) {}
});

module.exports = defaultInstance;
