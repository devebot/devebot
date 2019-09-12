'use strict';

const Injektor = require('injektor');
const lodash = require('lodash');
const path = require('path');
const chores = require('./utils/chores');
const constx = require('./utils/constx');
const LoggingWrapper = require('./backbone/logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

const CONSTRUCTORS = {};
const SERVICE_NAMES = [
  'sandbox-manager', 'schema-validator', 'script-executor', 'script-renderer',
  'security-manager', 'bridge-loader', 'bundle-loader',
  'object-decorator', 'logging-factory', 'process-manager',
]
if (chores.isUpgradeSupported('builtin-mapping-loader')) {
  SERVICE_NAMES.push('mapping-loader');
}
chores.loadServiceByNames(CONSTRUCTORS, path.join(__dirname, 'backbone'), SERVICE_NAMES);

function Kernel(params = {}) {
  const loggingWrapper = new LoggingWrapper(blockRef);
  const L = loggingWrapper.getLogger();
  const T = loggingWrapper.getTracer();

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  // init the default parameters
  const { configObject, issueInspector, stateInspector, manifestHandler } = params;

  // create injektor instance
  const injektor = new Injektor(chores.injektorOptions);

  lodash.forEach([
    'appName', 'appInfo', 'bridgeList', 'bundleList', 'contextManager', 'nameResolver'
  ], function(refName) {
    injektor.registerObject(refName, params[refName], chores.injektorContext);
  });

  injektor
    .registerObject('issueInspector', issueInspector, chores.injektorContext)
    .registerObject('profileNames', configObject['profile']['names'], chores.injektorContext)
    .registerObject('profileConfig', configObject['profile']['mixture'], chores.injektorContext)
    .registerObject('sandboxNames', configObject['sandbox']['names'], chores.injektorContext)
    .registerObject('sandboxConfig', configObject['sandbox']['mixture'], chores.injektorContext)
    .registerObject('textureNames', configObject['texture']['names'], chores.injektorContext)
    .registerObject('textureConfig', configObject['texture']['mixture'], chores.injektorContext);

  lodash.forOwn(CONSTRUCTORS, function(constructor, serviceName) {
    injektor.defineService(serviceName, constructor, chores.injektorContext);
  });

  if (chores.isUpgradeSupported('metadata-refiner')) {
    const SELECTED_FIELDS = manifestHandler.SELECTED_FIELDS;
    // validate bridge's configures
    const bridgeLoader = injektor.lookup('bridgeLoader', chores.injektorContext);
    const bridgeMetadata = bridgeLoader.loadMetadata();
    L.has('silly') && L.log('silly', T.add({ metadata: bridgeMetadata }).toMessage({
      tags: [ blockRef, 'bridge-config-schema-input' ],
      text: " - bridge's metadata: ${ metadata }"
    }));
    const bridgeSchema = extractBridgeSchema(SELECTED_FIELDS, bridgeMetadata);

    // validate plugin's configures
    const bundleLoader = injektor.lookup('bundleLoader', chores.injektorContext);
    const bundleMetadata = bundleLoader.loadMetadata();
    L.has('silly') && L.log('silly', T.add({ metadata: bundleMetadata }).toMessage({
      tags: [ blockRef, 'plugin-config-schema-input' ],
      text: " - plugin's metadata: ${metadata}"
    }));
    const bundleSchema = extractBundleSchema(SELECTED_FIELDS, bundleMetadata);

    const result = manifestHandler.validateConfig(configObject, bridgeSchema, bundleSchema);
    issueInspector.collect(result).barrier({ invoker: blockRef, footmark: 'metadata-validating' });
  }

  // initialize plugins, bridges, sandboxManager
  const sandboxManager = injektor.lookup('sandboxManager', chores.injektorContext);

  const profileConfig = injektor.lookup('profileConfig', chores.injektorContext);
  const frameworkCfg = profileConfig[constx.FRAMEWORK.NAME] || {};
  const inOpts = lodash.assign({ invoker: blockRef, footmark: 'sandbox-loading' }, frameworkCfg);
  issueInspector.barrier(inOpts);
  stateInspector.conclude(inOpts);

  this.invoke = function(block) {
    return lodash.isFunction(block) && Promise.resolve().then(function() {
      return block(injektor);
    });
  }

  if (frameworkCfg.coupling === 'loose') {
    this.getSandboxManager = function() {
      return sandboxManager;
    }
    this.getSandboxService = function(serviceName, context) {
      return sandboxManager.getSandboxService(serviceName, context);
    }
  }

  this._injektor = injektor;

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

module.exports = Kernel;

//-----------------------------------------------------------------------------

function extractBridgeSchema(selectedFields, bridgeMetadata) {
  const bridgeSchema = {};
  lodash.forOwn(bridgeMetadata, function(metadata, bridgeCode) {
    bridgeSchema[bridgeCode] = lodash.pick(metadata, selectedFields);
  });
  return bridgeSchema;
}

//-----------------------------------------------------------------------------

function extractBundleSchema(selectedFields, bundleMetadata) {
  const bundleSchema = {};
  bundleSchema.profile = bundleSchema.profile || {};
  bundleSchema.sandbox = bundleSchema.sandbox || {};
  lodash.forOwn(bundleMetadata, function(metainf, key) {
    const def = metainf && metainf.default || {};
    if (def.pluginCode && ['profile', 'sandbox'].indexOf(def.type) >= 0) {
      if (chores.isSpecialBundle(def.pluginCode)) {
        bundleSchema[def.type][def.pluginCode] = lodash.pick(def, selectedFields);
      } else {
        bundleSchema[def.type]['plugins'] = bundleSchema[def.type]['plugins'] || {};
        bundleSchema[def.type]['plugins'][def.pluginCode] = lodash.pick(def, selectedFields);
      }
    }
  });
  return bundleSchema;
}
