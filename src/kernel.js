'use strict';

var Injektor = require('injektor');
var lodash = require('lodash');
var path = require('path');
var chores = require('./utils/chores.js');
var LoggingWrapper = require('./backbone/logging-wrapper.js');
var errorHandler = require('./backbone/error-handler.js').instance;
var blockRef = chores.getBlockRef(__filename);

var CONSTRUCTORS = {};
chores.loadServiceByNames(CONSTRUCTORS, path.join(__dirname, 'backbone'), [
  'sandbox-manager', 'schema-validator', 'script-executor', 'script-renderer',
  'security-manager', 'bridge-loader', 'plugin-loader', 'logging-factory'
]);

function Kernel(params) {
  var loggingWrapper = new LoggingWrapper(blockRef);
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
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

  var schemaValidator = injektor.lookup('schemaValidator', chores.injektorContext);
  var result = [];

  // validate bridge's configures
  var bridgeLoader = injektor.lookup('bridgeLoader', chores.injektorContext);
  let bridgeMetadata = {};
  bridgeLoader.loadMetadata(bridgeMetadata);

  LX.has('silly') && LX.log('silly', LT.add({
    metadata: bridgeMetadata
  }).toMessage({
    tags: [ blockRef, 'bridge-config-schema-input' ],
    text: " - bridge's metadata: ${metadata}"
  }));

  var bridgeConfig = lodash.get(params, ['sandbox', 'mixture', 'bridges'], {});

  validateBridgeConfig({LX, LT, schemaValidator}, bridgeConfig, bridgeMetadata, result);

  // validate plugin's configures
  var pluginLoader = injektor.lookup('pluginLoader', chores.injektorContext);
  var pluginMetadata = {};
  pluginLoader.loadMetadata(pluginMetadata);

  LX.has('silly') && LX.log('silly', LT.add({
    metadata: pluginMetadata
  }).toMessage({
    tags: [ blockRef, 'plugin-config-schema-input' ],
    text: " - plugin's metadata: ${metadata}"
  }));

  var SELECTED_FIELDS = [ 'crateScope', 'schema', 'extension' ];
  var extractPluginSchema = function(pluginMetadata) {
    var configSchema = { profile: {}, sandbox: {} };
    lodash.forOwn(pluginMetadata, function(ref, key) {
      var def = ref && ref.default || {};
      if (def.pluginCode && ['profile', 'sandbox'].indexOf(def.type) >= 0) {
        if (chores.isSpecialPlugin(def.pluginCode)) {
          configSchema[def.type][def.pluginCode] = lodash.pick(def, SELECTED_FIELDS);
        } else {
          configSchema[def.type]['plugins'] = configSchema[def.type]['plugins'] || {};
          configSchema[def.type]['plugins'][def.pluginCode] = lodash.pick(def, SELECTED_FIELDS);
        }
      }
    });
    return configSchema;
  }
  var pluginSchema = extractPluginSchema(pluginMetadata);

  var pluginConfig = {
    profile: lodash.get(params, ['profile', 'mixture'], {}),
    sandbox: lodash.pick(lodash.get(params, ['sandbox', 'mixture'], {}), ['application', 'plugins'])
  }

  LX.has('silly') && LX.log('silly', LT.add({
    pluginConfig: pluginConfig,
    pluginSchema: pluginSchema
  }).toMessage({
    tags: [ blockRef, 'validate-plugin-config-by-schema' ],
    text: ' - Synchronize the structure of configuration data and schemas'
  }));

  validatePluginConfig({LX, LT, schemaValidator}, pluginConfig, pluginSchema, result);

  // summarize validating result
  LX.has('silly') && LX.log('silly', LT.add({
    validatingResult: result
  }).toMessage({
    tags: [ blockRef, 'validating-config-by-schema-result' ],
    text: ' - Validating sandbox configuration using schemas'
  }));

  errorHandler.collect(result).barrier({ invoker: blockRef });

  this.invoke = function(block) {
    return lodash.isFunction(block) && Promise.resolve(block(injektor));
  }

  this._injektor = injektor;

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

module.exports = Kernel;

let validateBridgeConfig = function(ctx, bridgeConfig, bridgeSchema, result) {
  let { LX, LT, schemaValidator } = ctx;
  result = result || [];

  bridgeConfig = bridgeConfig || {};
  bridgeSchema = bridgeSchema || {};

  LX.has('silly') && LX.log('silly', LT.add({
    bridgeConfig: bridgeConfig,
    bridgeSchema: bridgeSchema
  }).toMessage({
    tags: [ blockRef, 'validate-bridge-config-by-schema' ],
    text: ' - bridge config/schema:\n${bridgeSchema}\n${bridgeConfig}'
  }));

  let customizeResult = function(result, bridgeCode, pluginName, dialectName) {
    let output = {};
    output.stage = 'config/schema';
    output.name = pluginName + '/' + bridgeCode + '#' + dialectName;
    output.type = 'bridge';
    output.hasError = result.ok !== true;
    if (!result.ok && result.errors) {
      output.stack = JSON.stringify(result.errors, null, 2);
    }
    return output;
  }

  if (chores.isOldFeatures()) {
    for(let dialectName in bridgeConfig) {
      let dialectMap = bridgeConfig[dialectName] || {};
      for(let bridgeCode in dialectMap) {
        let dialectSchema = lodash.get(bridgeSchema, [bridgeCode, 'metadata', 'schema'], null);
        if (lodash.isNull(dialectSchema)) continue;
        let dialectConfig = dialectMap[bridgeCode] || {};
        let r = schemaValidator.validate(dialectConfig, dialectSchema);
        result.push(customizeResult(r, bridgeCode, '*', dialectName));
      }
    }
    return result;
  }

  for(let bridgeCode in bridgeConfig) {
    let bridgeMap = bridgeConfig[bridgeCode] || {};
    let dialectSchema = lodash.get(bridgeSchema, [bridgeCode, 'metadata', 'schema'], null);
    if (lodash.isNull(dialectSchema)) continue;
    for(let pluginName in bridgeMap) {
      let pluginMap = bridgeMap[pluginName] || {};
      for(let dialectName in pluginMap) {
        let dialectConfig = pluginMap[dialectName] || {};
        let r = schemaValidator.validate(dialectConfig, dialectSchema);
        result.push(customizeResult(r, bridgeCode, pluginName, dialectName));
      }
    }
  }

  return result;
}

let validatePluginConfig = function(ctx, pluginConfig, pluginSchema, result) {
  let { LX, LT, schemaValidator } = ctx;
  result = result || [];

  let sandboxConfig = pluginConfig.sandbox || {};
  let sandboxSchema = pluginSchema.sandbox || {};

  let customizeResult = function(result, crateScope, crateName) {
    let output = {};
    output.stage = 'config/schema';
    output.name = crateScope;
    output.type = chores.isSpecialPlugin(crateName) ? crateName : 'plugin';
    output.hasError = result.ok !== true;
    if (!result.ok && result.errors) {
      output.stack = JSON.stringify(result.errors, null, 2);
    }
    return output;
  }

  let validateSandbox = function(result, crateConfig, crateSchema, crateName) {
    if (crateSchema && crateSchema.schema) {
      let r = schemaValidator.validate(crateConfig, crateSchema.schema);
      result.push(customizeResult(r, crateSchema.crateScope, crateName));
    } else {
      LX.has('silly') && LX.log('silly', LT.add({
        name: crateName,
        config: crateConfig,
        schema: crateSchema
      }).toMessage({
        tags: [ blockRef, 'validate-plugin-config-by-schema-skipped' ],
        text: ' - Validate sandboxConfig[${name}] is skipped'
      }));
    }
  }

  if (sandboxConfig.application) {
    validateSandbox(result, sandboxConfig.application, sandboxSchema.application, 'application');
  }

  if (sandboxConfig.plugins) {
    lodash.forOwn(sandboxConfig.plugins, function(pluginObject, pluginName) {
      if (lodash.isObject(sandboxSchema.plugins)) {
        validateSandbox(result, pluginObject, sandboxSchema.plugins[pluginName], pluginName);
      }
    });
  }
}