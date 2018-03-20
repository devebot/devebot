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
  var blockRef = chores.getBlockRef(__filename);
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

  var configObject = {
    profile: lodash.get(params, ['profile', 'mixture'], {}),
    sandbox: lodash.get(params, ['sandbox', 'mixture'], {})
  }

  // validate bridge's configures
  var bridgeLoader = injektor.lookup('bridgeLoader', chores.injektorContext);
  var bridgeConfig = lodash.get(params, ['sandbox', 'mixture', 'bridges'], {});
  validateBridgeConfig({LX, LT, bridgeLoader, schemaValidator}, bridgeConfig, result);

  // validate plugin's configures
  var schemaMap = {};
  var pluginLoader = injektor.lookup('pluginLoader', chores.injektorContext);
  pluginLoader.loadSchemas(schemaMap);

  LX.has('silly') && LX.log('silly', LT.add({
    configMap: params,
    schemaMap: schemaMap
  }).toMessage({
    tags: [ blockRef, 'config-schema-loading' ],
    text: ' - Sandbox schemas: ${schemaMap}'
  }));

  var SELECTED_FIELDS = [ 'crateScope', 'schema', 'extension' ];
  var extractPluginSchema = function(schemaMap) {
    var configSchema = { profile: {}, sandbox: {} };
    lodash.forOwn(schemaMap, function(ref, key) {
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
  var configSchema = extractPluginSchema(schemaMap);

  LX.has('silly') && LX.log('silly', LT.add({
    configObject: configObject,
    configSchema: configSchema
  }).toMessage({
    tags: [ blockRef, 'config-schema-synchronizing' ],
    text: ' - Synchronize the structure of configuration data and schemas'
  }));

  var sandboxObject = configObject.sandbox || {};
  var sandboxSchema = configSchema.sandbox || {};

  var customizeResult = function(result, crateConfig, crateSchema, crateName) {
    var output = {};
    output.stage = 'config/schema';
    output.name = crateSchema.crateScope;
    output.type = chores.isSpecialPlugin(crateName) ? crateName : 'plugin';
    output.hasError = result.ok !== true;
    if (!result.ok && result.errors) {
      output.stack = JSON.stringify(result.errors, null, 2);
    }
    return output;
  }

  var validatePluginConfig = function(result, crateConfig, crateSchema, crateName) {
    if (crateSchema && crateSchema.schema) {
      var r = schemaValidator.validate(crateConfig, crateSchema.schema);
      result.push(customizeResult(r, crateConfig, crateSchema, crateName));
    } else {
      LX.has('silly') && LX.log('silly', LT.add({
        name: crateName,
        config: crateConfig,
        schema: crateSchema
      }).toMessage({
        tags: [ blockRef, 'sandbox-config-validation-skipped' ],
        text: ' - Validate sandboxConfig[${name}] is skipped'
      }));
    }
  }

  if (sandboxObject.application) {
    validatePluginConfig(result, sandboxObject.application, sandboxSchema.application, 'application');
  }

  if (sandboxObject.plugins) {
    lodash.forOwn(sandboxObject.plugins, function(pluginConfig, pluginName) {
      if (lodash.isObject(sandboxSchema.plugins)) {
        validatePluginConfig(result, pluginConfig, sandboxSchema.plugins[pluginName], pluginName);
      }
    });
  }

  // summarize validating result
  LX.has('silly') && LX.log('silly', LT.add({
    validatingResult: result
  }).toMessage({
    tags: [ blockRef, 'config-schema-validating' ],
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

let validateBridgeConfig = function(ctx, bridgeConfig, result) {
  let { LX, LT, bridgeLoader, schemaValidator } = ctx;
  bridgeConfig = bridgeConfig || {};
  result = result || [];

  let bridgeMetadata = {};
  bridgeLoader.loadMetadata(bridgeMetadata);

  var customizeResult = function(result, bridgeCode, pluginName, dialectName) {
    var output = {};
    output.stage = 'bridge/schema';
    output.name = pluginName + '/' + bridgeCode + '#' + dialectName;
    output.type = 'bridge';
    output.hasError = result.ok !== true;
    if (!result.ok && result.errors) {
      output.stack = JSON.stringify(result.errors, null, 2);
    }
    return output;
  }

  var validateDialects = function(metadata, mapping) {
    LX.has('silly') && LX.log('silly', LT.add({
      metadata: metadata,
      mapping: mapping
    }).toMessage({
      text: ' - bridge metadata:\n${metadata}\n${mapping}'
    }));
    for(var bridgeCode in mapping) {
      var bridgeMap = mapping[bridgeCode] || {};
      var _schema = lodash.get(metadata, [bridgeCode, 'metadata', 'schema'], null);
      if (lodash.isNull(_schema)) continue;
      for(var pluginName in bridgeMap) {
        var pluginMap = bridgeMap[pluginName] || {};
        for(var dialectName in pluginMap) {
          var dialectConfig = pluginMap[dialectName] || {};
          var r = schemaValidator.validate(dialectConfig, _schema);
          result.push(customizeResult(r, bridgeCode, pluginName, dialectName));
        }
      }
    }
    return result;
  }

  return validateDialects(bridgeMetadata, bridgeConfig);
}
