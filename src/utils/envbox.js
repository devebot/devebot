'use strict';

const constx = require('./constx');
const Envcloak = require('envcloak');

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
    name: "TEXTURE",
    type: "string",
    description: "Customized texture names, merged from right to left"
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
    name: "CONFIG_TEXTURE_ALIASES",
    type: "array",
    defaultValue: [],
    description: "Aliases of the file name prefix of the [texture] configuration"
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
    defaultValue: constx.FRAMEWORK.NAME,
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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ default instance

const defaultInstance = new Envcloak({
  definition: ENV_DEF_DEFAULT
});

Object.defineProperty(defaultInstance, 'new', {
  get: function() {
    return function(kwargs) {
      return new Envcloak(kwargs);
    };
  },
  set: function(value) {}
});

module.exports = defaultInstance;
