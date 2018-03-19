'use strict';

var Injektor = require('injektor');
var lodash = require('lodash');
var path = require('path');
var chores = require('./utils/chores.js');
var LoggingWrapper = require('./backbone/logging-wrapper.js');
var errorHandler = require('./backbone/error-handler.js').instance;

var CONSTRUCTORS = {};
chores.loadServiceByNames(CONSTRUCTORS, path.join(__dirname, 'backbone'), [
  'sandbox-manager', 'schema-validator', 'script-executor', 'script-renderer',
  'security-manager', 'bridge-loader', 'plugin-loader', 'logging-factory'
]);

function Kernel(params) {
  var crateID = chores.getBlockRef(__filename);
  var loggingWrapper = new LoggingWrapper(crateID);
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ crateID, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  // init the default parameters
  params = params || {};

  // create injektor instance
  var injektor = new Injektor(chores.injektorOptions);

  ['appName', 'appInfo', 'bridgeRefs', 'pluginRefs'].forEach(function(refName) {
    injektor.registerObject(refName, params[refName], chores.injektorContext);
  });

  injektor
    .registerObject('sandboxNames', params['sandbox']['names'], chores.injektorContext)
    .registerObject('sandboxConfig', params['sandbox']['mixture'], chores.injektorContext)
    .registerObject('profileNames', params['profile']['names'], chores.injektorContext)
    .registerObject('profileConfig', params['profile']['mixture'], chores.injektorContext);

  lodash.forOwn(CONSTRUCTORS, function(constructor, serviceName) {
    injektor.defineService(serviceName, constructor, chores.injektorContext);
  });

  var schemaMap = {};
  var pluginLoader = injektor.lookup('pluginLoader', chores.injektorContext);
  pluginLoader.loadSchemas(schemaMap);

  LX.has('silly') && LX.log('silly', LT.add({
    configMap: params,
    schemaMap: schemaMap
  }).toMessage({
    tags: [ crateID, 'config-schema-loading' ],
    text: ' - Sandbox schemas: ${schemaMap}'
  }));

  var SPECIAL_PLUGINS = ['application', 'devebot'];
  var SELECTED_FIELDS = [ 'moduleId', 'schema', 'extension' ];
  var extractConfigSchema = function(schemaMap) {
    var configSchema = { profile: {}, sandbox: {} };
    lodash.forOwn(schemaMap, function(ref, key) {
      var def = ref && ref.default || {};
      if (def.pluginName && ['profile', 'sandbox'].indexOf(def.type) >= 0) {
        if (SPECIAL_PLUGINS.indexOf(def.pluginName) >= 0) {
          configSchema[def.type][def.pluginName] = lodash.pick(def, SELECTED_FIELDS);
        } else {
          configSchema[def.type]['plugins'] = configSchema[def.type]['plugins'] || {};
          configSchema[def.type]['plugins'][def.pluginName] = lodash.pick(def, SELECTED_FIELDS);
        }
      }
    });
    return configSchema;
  }
  var configSchema = extractConfigSchema(schemaMap);

  var configObject = {
    profile: lodash.get(params, ['profile', 'mixture'], {}),
    sandbox: lodash.get(params, ['sandbox', 'mixture'], {})
  }

  LX.has('silly') && LX.log('silly', LT.add({
    configObject: configObject,
    configSchema: configSchema
  }).toMessage({
    tags: [ crateID, 'config-schema-synchronizing' ],
    text: ' - Synchronize the structure of configuration data and schemas'
  }));

  var schemaValidator = injektor.lookup('schemaValidator', chores.injektorContext);
  var result = [];

  var sandboxObject = configObject.sandbox || {};
  var sandboxSchema = configSchema.sandbox || {};

  var customizeResult = function(result, crateConfig, crateSchema, crateName) {
    var output = {};
    output.stage = 'config/schema';
    output.name = crateSchema.moduleId;
    output.type = SPECIAL_PLUGINS.indexOf(crateName) >= 0 ? crateName : 'plugin';
    output.hasError = result.ok !== true;
    if (!result.ok && result.errors) {
      output.stack = JSON.stringify(result.errors, null, 2);
    }
    return output;
  }

  var validateCrateConfig = function(result, crateConfig, crateSchema, crateName) {
    if (crateSchema && crateSchema.schema) {
      var r = schemaValidator.validate(crateConfig, crateSchema.schema);
      result.push(customizeResult(r, crateConfig, crateSchema, crateName));
    } else {
      LX.has('silly') && LX.log('silly', LT.add({
        name: crateName,
        config: crateConfig,
        schema: crateSchema
      }).toMessage({
        tags: [ crateID, 'sandbox-config-validation-skipped' ],
        text: ' - Validate sandboxConfig[${name}] is skipped'
      }));
    }
  }

  if (sandboxObject.application) {
    validateCrateConfig(result, sandboxObject.application, sandboxSchema.application, 'application');
  }

  if (sandboxObject.plugins) {
    lodash.forOwn(sandboxObject.plugins, function(pluginConfig, pluginName) {
      if (lodash.isObject(sandboxSchema.plugins)) {
        validateCrateConfig(result, pluginConfig, sandboxSchema.plugins[pluginName], pluginName);
      }
    });
  }

  LX.has('silly') && LX.log('silly', LT.add({
    validatingResult: result
  }).toMessage({
    tags: [ crateID, 'config-schema-validating' ],
    text: ' - Validating sandbox configuration using schemas'
  }));

  errorHandler.collect(result).barrier({ invoker: crateID });

  this.invoke = function(block) {
    return lodash.isFunction(block) && Promise.resolve(block(injektor));
  }

  this._injektor = injektor;

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ crateID, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

module.exports = Kernel;
