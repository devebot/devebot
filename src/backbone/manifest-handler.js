'use strict';

const lodash = require('lodash');
const path = require('path');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

const SELECTED_FIELDS = [ 'crateScope', 'extension', 'schema', 'checkConstraints' ];

function ManifestHandler(params = {}) {
  const {nameResolver, issueInspector, bridgeList, bundleList} = params;
  const loggingWrapper = new LoggingWrapper(blockRef);
  const L = loggingWrapper.getLogger();
  const T = loggingWrapper.getTracer();
  const C = { nameResolver, L, T };

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  if (chores.isUpgradeSupported('manifest-refiner')) {
    lodash.forOwn(bridgeList, function(ref) {
      ref.manifest = loadManifest(ref, issueInspector);
      ref.version = loadPackageVersion(ref);
    });
    lodash.forOwn(bundleList, function(ref) {
      if (chores.isFrameworkBundle(ref)) return;
      if (!lodash.isString(ref.path)) return;
      ref.manifest = loadManifest(ref, issueInspector);
      ref.version = loadPackageVersion(ref);
    });
  }

  this.SELECTED_FIELDS = SELECTED_FIELDS;

  this.validateConfig = function (configStore, bridgeSchema, bundleSchema, result = []) {
    const bridgeConfig = lodash.get(configStore, ['sandbox', 'mixture', 'bridges'], {});
    validateBridgeConfig(C, bridgeConfig, combineBridgeSchema(C, bridgeList, bridgeSchema), result);

    const bundleConfig = {
      profile: lodash.get(configStore, ['profile', 'mixture'], {}),
      sandbox: lodash.pick(lodash.get(configStore, ['sandbox', 'mixture'], {}), ['application', 'plugins'])
    }
    validateBundleConfig(C, bundleConfig, combineBundleSchema(C, bundleList, bundleSchema), result);

    // summarize validating result
    L.has('silly') && L.log('silly', T.add({ result }).toMessage({
      tags: [ blockRef, 'validating-config-by-schema-result' ],
      text: ' - Validating sandbox configuration using schemas'
    }));

    return result;
  }

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

ManifestHandler.argumentSchema = {
  "$id": "manifestHandler",
  "type": "object",
  "properties": {
    "issueInspector": {
      "type": "object"
    },
    "nameResolver": {
      "type": "object"
    }
  }
};

module.exports = ManifestHandler;

//-----------------------------------------------------------------------------

function combineBridgeSchema(ref, bridgeList, bridgeSchema = {}) {
  const { nameResolver } = ref;
  lodash.forEach(bridgeList, function(bridgeRef) {
    let bridgeCode = nameResolver.getDefaultAliasOf(bridgeRef.name, bridgeRef.type);
    if (!chores.isUpgradeSupported('refining-name-resolver')) {
      bridgeCode = nameResolver.getDefaultAlias(bridgeRef);
    }
    if (chores.isUpgradeSupported('manifest-refiner')) {
      const validationBlock = lodash.get(bridgeRef, ['manifest', constx.MANIFEST.DEFAULT_ROOT_NAME, 'validation']);
      if (lodash.isObject(validationBlock)) {
        bridgeSchema[bridgeCode] = lodash.pick(validationBlock, SELECTED_FIELDS);
      }
    }
    // apply 'schemaValidation' option from presets for bridges
    bridgeSchema[bridgeCode] = bridgeSchema[bridgeCode] || {};
    if (bridgeRef.presets && bridgeRef.presets.schemaValidation === false) {
      lodash.set(bridgeSchema, [bridgeCode, 'enabled'], false);
    }
  });
  return bridgeSchema;
}

function validateBridgeConfig(ref, bridgeConfig, bridgeSchema, result) {
  const { L, T } = ref;
  result = result || [];

  bridgeConfig = bridgeConfig || {};
  bridgeSchema = bridgeSchema || {};

  L.has('silly') && L.log('silly', T.add({ bridgeConfig, bridgeSchema }).toMessage({
    tags: [ blockRef, 'validate-bridge-config-by-schema' ],
    text: ' - bridge config/schema:\n${bridgeSchema}\n${bridgeConfig}'
  }));

  if (!chores.isUpgradeSupported('bridge-full-ref')) {
    for (const dialectName in bridgeConfig) {
      const dialectMap = bridgeConfig[dialectName] || {};
      for (const bridgeCode in dialectMap) {
        const bridgeMetadata = lodash.get(bridgeSchema, [bridgeCode], {});
        if (bridgeMetadata.enabled === false || !lodash.isObject(bridgeMetadata.schema)) continue;
        const dialectConfig = dialectMap[bridgeCode] || {};
        const r = chores.validate(dialectConfig, bridgeMetadata.schema);
        result.push(customizeBridgeResult(r, bridgeCode, '*', dialectName));
      }
    }
    return result;
  }

  for (const bridgeCode in bridgeConfig) {
    const bridgeMap = bridgeConfig[bridgeCode] || {};
    const bridgeMetadata = lodash.get(bridgeSchema, [bridgeCode], {});
    if (bridgeMetadata.enabled === false || !lodash.isObject(bridgeMetadata.schema)) continue;
    for (const pluginName in bridgeMap) {
      const pluginMap = bridgeMap[pluginName] || {};
      for (const dialectName in pluginMap) {
        const dialectConfig = pluginMap[dialectName] || {};
        const r = chores.validate(dialectConfig, bridgeMetadata.schema);
        result.push(customizeBridgeResult(r, bridgeCode, pluginName, dialectName));
      }
    }
  }

  return result;
}

function customizeBridgeResult(result, bridgeCode, pluginName, dialectName) {
  const output = {};
  output.stage = 'config/schema';
  output.name = [pluginName, chores.getSeparator(), bridgeCode, '#', dialectName].join('');
  output.type = 'bridge';
  output.hasError = result.ok !== true;
  if (!result.ok && result.errors) {
    output.stack = JSON.stringify(result.errors, null, 2);
  }
  return output;
}

//-----------------------------------------------------------------------------

function combineBundleSchema(ref, bundleList, bundleSchema = {}) {
  const { L, T, nameResolver } = ref;
  bundleSchema.profile = bundleSchema.profile || {};
  bundleSchema.sandbox = bundleSchema.sandbox || {};
  lodash.forEach(bundleList, function(bundleRef) {
    let pluginCode = nameResolver.getDefaultAliasOf(bundleRef.name, bundleRef.type);
    if (!chores.isUpgradeSupported('refining-name-resolver')) {
      pluginCode = nameResolver.getDefaultAlias(bundleRef);
    }
    if (chores.isUpgradeSupported('manifest-refiner')) {
      const configType = 'sandbox';
      let validationBlock = lodash.get(bundleRef, ['manifest', constx.MANIFEST.DEFAULT_ROOT_NAME, 'validation']);
      if (lodash.isObject(validationBlock)) {
        validationBlock = lodash.pick(validationBlock, SELECTED_FIELDS);
        validationBlock.crateScope = nameResolver.getOriginalNameOf(bundleRef.name, bundleRef.type);
        if (chores.isSpecialBundle(pluginCode)) {
          bundleSchema[configType][pluginCode] = validationBlock;
        } else {
          bundleSchema[configType]['plugins'] = bundleSchema[configType]['plugins'] || {};
          bundleSchema[configType]['plugins'][pluginCode] = validationBlock;
        }
      }
    }
    // apply 'schemaValidation' option from presets for plugins
    if (bundleRef.presets && bundleRef.presets.schemaValidation === false) {
      if (!chores.isSpecialBundle(pluginCode)) {
        lodash.forEach(['profile', 'sandbox'], function(configType) {
          lodash.set(bundleSchema, [configType, 'plugins', pluginCode, 'enabled'], false);
        });
      }
    }
    // apply 'pluginDepends' & 'bridgeDepends' to bundleSchema
    lodash.forEach(['bridgeDepends', 'pluginDepends'], function(depType) {
      if (lodash.isArray(bundleRef[depType])) {
        lodash.set(bundleSchema, ['sandbox', 'plugins', pluginCode, depType], bundleRef[depType]);
      }
    });
  });
  return bundleSchema;
}

function validateBundleConfig(ref, bundleConfig, bundleSchema, result) {
  const { L, T } = ref;
  L.has('silly') && L.log('silly', T.add({ bundleConfig, bundleSchema }).toMessage({
    tags: [ blockRef, 'validate-bundle-config-by-schema' ],
    text: ' - Synchronize the structure of configuration data and schemas'
  }));
  result = result || [];
  validateSandboxSchemaOfCrates(ref, result, bundleConfig.sandbox, bundleSchema.sandbox);
  checkSandboxConstraintsOfCrates(ref, result, bundleConfig.sandbox, bundleSchema.sandbox);
}

function validateSandboxSchemaOfCrates(ref, result, config, schema) {
  const { L, T } = ref;
  config = config || {};
  schema = schema || {};
  if (config.application) {
    validateSandboxSchemaOfCrate(ref, result, config.application, schema.application, 'application');
  }
  if (config.plugins) {
    lodash.forOwn(config.plugins, function(pluginObject, pluginName) {
      if (lodash.isObject(schema.plugins)) {
        validateSandboxSchemaOfCrate(ref, result, pluginObject, schema.plugins[pluginName], pluginName);
      }
    });
  }
}

function validateSandboxSchemaOfCrate(ref, result, crateConfig, crateSchema, crateName) {
  const { L, T } = ref;
  if (crateSchema && crateSchema.enabled !== false && lodash.isObject(crateSchema.schema)) {
    const r = chores.validate(crateConfig, crateSchema.schema);
    result.push(customizeSandboxResult(r, crateSchema.crateScope, 'schema'));
  } else {
    L.has('silly') && L.log('silly', T.add({ crateName, crateConfig, crateSchema }).toMessage({
      tags: [ blockRef, 'validate-bundle-config-by-schema-skipped' ],
      text: ' - Validating sandboxConfig[${crateName}] is skipped'
    }));
  }
}

function checkSandboxConstraintsOfCrates(ref, result, config, schema) {
  const { L, T } = ref;
  config = config || {};
  schema = schema || {};
  if (lodash.isObject(config.application)) {
    checkSandboxConstraintsOfAppbox(ref, result, config, schema);
  }
  if (lodash.isObject(config.plugins)) {
    lodash.forOwn(config.plugins, function(pluginObject, pluginName) {
      checkSandboxConstraintsOfPlugin(ref, result, config, schema, pluginName);
    });
  }
}

function checkSandboxConstraintsOfAppbox(ref, result, config, schema) {
  const { L, T } = ref;
  const crateName = 'application';
  const crateConfig = config.application;
  const crateSchema = schema.application;
  const checkConstraints = crateSchema && crateSchema.checkConstraints;
  if (lodash.isFunction(checkConstraints)) {
    const extractedCfg = { plugins: {}, bridges: {} };
    extractedCfg.application = crateConfig;
    lodash.forEach(crateSchema.pluginDepends, function(depName) {
      extractedCfg.plugins[depName] = config.plugins[depName];
    });
    lodash.forEach(crateSchema.bridgeDepends, function(depName) {
      extractedCfg.bridges[depName] = lodash.get(config, ["bridges", depName, crateName]);
    });
    const r = applyCheckConstraints(checkConstraints, extractedCfg, crateName);
    result.push(customizeSandboxResult(r, crateSchema.crateScope, 'constraints'));
  }
}

function checkSandboxConstraintsOfPlugin(ref, result, config, schema, crateName) {
  const { L, T } = ref;
  const crateConfig = config.plugins[crateName];
  const crateSchema = schema && schema.plugins && schema.plugins[crateName];
  const checkConstraints = crateSchema && crateSchema.checkConstraints;
  if (lodash.isFunction(checkConstraints)) {
    const extractedCfg = { plugins: {}, bridges: {} };
    extractedCfg.plugins[crateName] = crateConfig;
    lodash.forEach(crateSchema.pluginDepends, function(depName) {
      if (depName === crateName) {
        const r = { ok: false, reason: { pluginName: crateName, message: 'plugin depends on itself' } };
        result.push(customizeSandboxResult(r, crateSchema.crateScope, 'constraints'));
      }
      extractedCfg.plugins[depName] = config.plugins[depName];
    });
    lodash.forEach(crateSchema.bridgeDepends, function(depName) {
      extractedCfg.bridges[depName] = lodash.get(config, ["bridges", depName, crateName]);
    });
    const r = applyCheckConstraints(checkConstraints, extractedCfg, crateName);
    result.push(customizeSandboxResult(r, crateSchema.crateScope, 'constraints'));
  }
}

function applyCheckConstraints(checkConstraints, extractedCfg, crateName) {
  try {
    return checkConstraints(extractedCfg);
  } catch (error) {
    const moduleLabel = (crateName !== 'application') ? 'plugins[' + crateName + ']' : crateName;
    return { ok: false, reason: util.format('%s.checkConstraints() raises an error', moduleLabel) }
  }
}

function customizeSandboxResult(result, crateScope, validationType) {
  result = (result == undefined || result == null) ? false : result;
  result = (typeof result === 'boolean') ? { ok: result } : result;
  const output = {};
  output.stage = 'config/' + validationType;
  output.name = crateScope;
  output.type = chores.isSpecialBundle(crateScope) ? crateScope : 'plugin';
  output.hasError = result.ok !== true;
  if (!result.ok) {
    if (result.errors) {
      output.stack = JSON.stringify(result.errors, null, 2);
    }
    if (result.reason) {
      output.stack = result.reason;
    }
  }
  return output;
}

//-----------------------------------------------------------------------------

function loadPackageVersion(pkgRef, issueInspector) {
  chores.assertOk(pkgRef.path, pkgRef.type, pkgRef.name);
  const pkgInfo = chores.loadPackageInfo(pkgRef.path);
  const version = pkgInfo && pkgInfo.version;
  if (!lodash.isString(version)) {
    issueInspector && issueInspector.collect({
      hasError: true,
      stage: 'package-version',
      type: pkgRef.type,
      name: pkgRef.name,
    });
  }
  return version;
}

function loadManifest(pkgRef, issueInspector) {
  chores.assertOk(pkgRef.path, pkgRef.type, pkgRef.name, issueInspector);
  const manifest = safeloadManifest(pkgRef.path);
  if (!lodash.isEmpty(manifest)) {
    const result = chores.validate(manifest, constx.MANIFEST.SCHEMA_OBJECT);
    if (!result.ok) {
      issueInspector && issueInspector.collect({
        hasError: true,
        stage: 'manifest',
        type: pkgRef.type,
        name: pkgRef.name,
        stack: JSON.stringify(result.errors, null, 4)
      });
    }
  }
  return manifest;
}

function safeloadManifest(pkgPath) {
  try {
    const manifest = require(pkgPath).manifest;
    if (manifest) return manifest;
    return require(path.join(pkgPath, '/manifest.js'));
  } catch (err) {
    return null;
  }
}
