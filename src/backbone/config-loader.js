'use strict';

const lodash = require('lodash');
const util = require('util');
const path = require('path');

const chores = require('../utils/chores');
const constx = require('../utils/constx');
const loader = require('../utils/loader');
const errorHandler = require('./error-handler').instance;
const stateInspector = require('./state-inspector').instance;
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

const CONFIG_SUBDIR = '/config';
const CONFIG_PROFILE_NAME = process.env.DEVEBOT_CONFIG_PROFILE_NAME || 'profile';
const CONFIG_SANDBOX_NAME = process.env.DEVEBOT_CONFIG_SANDBOX_NAME || 'sandbox';
const CONFIG_TYPES = [CONFIG_PROFILE_NAME, CONFIG_SANDBOX_NAME];
const CONFIG_VAR_NAMES = { ctxName: 'PROFILE', boxName: 'SANDBOX', cfgDir: 'CONFIG_DIR', cfgEnv: 'CONFIG_ENV' };

function ConfigLoader(params={}) {
  let {appName, appOptions, appRef, devebotRef, pluginRefs, bridgeRefs, nameResolver} = params;
  let loggingWrapper = new LoggingWrapper(blockRef);
  let LX = loggingWrapper.getLogger();
  let LT = loggingWrapper.getTracer();
  let CTX = { LX, LT, nameResolver };

  let label = chores.stringLabelCase(appName);

  LX.has('silly') && LX.log('silly', LT.add({
    appName: appName,
    appOptions: appOptions,
    appRef: appRef,
    devebotRef: devebotRef,
    pluginRefs: pluginRefs,
    bridgeRefs: bridgeRefs,
    label: label
  }).toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + Config of application (${appName}) is loaded in name: ${label}'
  }));

  appOptions = appOptions || {};

  let config = loadConfig
      .bind(null, CTX, appName, appOptions, appRef, devebotRef, pluginRefs, bridgeRefs)
      .apply(null, Object.keys(CONFIG_VAR_NAMES).map(function(varName) {
        return readVariable(CTX, label, CONFIG_VAR_NAMES[varName]);
      }));

  Object.defineProperty(this, 'config', {
    get: function() { return config },
    set: function(value) {}
  });

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

module.exports = ConfigLoader;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

let readVariable = function(ctx, appLabel, varName) {
  let { LX, LT } = ctx || this;
  let varLabels = [
    util.format('%s_%s', appLabel, varName),
    util.format('%s_%s', 'DEVEBOT', varName),
    util.format('NODE_%s_%s', appLabel, varName),
    util.format('NODE_%s_%s', 'DEVEBOT', varName)
  ];
  let value, varLabel;
  for(const varLabel of varLabels) {
    value = process.env[varLabel];
    LX.has('conlog') && LX.log('conlog', LT.add({
      label: varLabel,
      value: value
    }).toMessage({
      text: ' - Get value of ${label}: ${value}'
    }));
    if (value) break;
  }
  LX.has('conlog') && LX.log('conlog', LT.add({
    label: varLabels[0],
    value: value
  }).toMessage({
    text: ' - Final value of ${label}: ${value}'
  }));
  return value;
}

let loadConfig = function(ctx, appName, appOptions, appRef, devebotRef, pluginRefs, bridgeRefs, profileName, sandboxName, customDir, customEnv) {
  let { LX, LT, nameResolver } = ctx || this;
  appOptions = appOptions || {};

  let {plugin: pluginAliasMap, bridge: bridgeAliasMap} = nameResolver.getAbsoluteAliasMap();
  let transCTX = { LX, LT, pluginAliasMap, bridgeAliasMap };

  let libRefs = lodash.values(pluginRefs);
  if (devebotRef) {
    libRefs.push(devebotRef);
  }

  let appRootDir = null;
  if (appRef && lodash.isString(appRef.path)) {
    appRootDir = path.dirname(appRef.path);
  };

  let config = {};
  let configDir = resolveConfigDir(ctx, appName, appRootDir, customDir, customEnv);

  LX.has('silly') && LX.log('silly', LT.add({ configDir }).toMessage({
    tags: [ blockRef, 'config-dir' ],
    text: ' - configDir: ${configDir}'
  }));

  let configFiles = [];
  if (configDir) {
    configFiles = chores.filterFiles(configDir, '.*\.js');
  }
  let configInfos = lodash.map(configFiles, function(file) {
    return file.replace('.js', '').split(/[_]/);
  });

  let includedNames = {};
  includedNames[CONFIG_PROFILE_NAME] = standardizeNames(ctx, profileName);
  includedNames[CONFIG_SANDBOX_NAME] = standardizeNames(ctx, sandboxName);

  let appProfiles = standardizeNames(ctx, appOptions.privateProfile || appOptions.privateProfiles);
  includedNames[CONFIG_PROFILE_NAME] = lodash.concat(
    lodash.difference(includedNames[CONFIG_PROFILE_NAME], appProfiles), appProfiles);

  let appSandboxes = standardizeNames(ctx, appOptions.privateSandbox || appOptions.privateSandboxes);
  includedNames[CONFIG_SANDBOX_NAME] = lodash.concat(
    lodash.difference(includedNames[CONFIG_SANDBOX_NAME], appSandboxes), appSandboxes);

  CONFIG_TYPES.forEach(function(configType) {
    config[configType] = config[configType] || {};

    LX.has('conlog') && LX.log('conlog', LT.toMessage({
      text: ' + load the default config from plugins & framework'
    }));
    lodash.forEach(libRefs, function(libRef) {
      if (libRef.presets && chores.isFeatureSupported('presets')) {
        LX.has('conlog') && LX.log('conlog', LT.add(libRef).toMessage({
          text: ' - Presets of ${type}[${name}]: ${presets}'
        }));
      }
      let libRootDir = path.dirname(libRef.path);
      let libType = libRef.type || 'plugin';
      let libName = libRef.name;
      let defaultFile = path.join(libRootDir, CONFIG_SUBDIR, configType + '.js');
      config[configType]['default'] = lodash.defaultsDeep(config[configType]['default'],
          transformConfig(transCTX, configType, loadConfigFile(ctx, defaultFile), libType, libName, libRef.presets));
    });

    if (configDir) {
      let defaultFile = path.join(configDir, configType + '.js');
      LX.has('conlog') && LX.log('conlog', LT.add({ defaultFile }).toMessage({
        text: ' + load the default application config: ${defaultFile}'
      }));
      config[configType]['expanse'] = transformConfig(transCTX, configType, loadConfigFile(ctx, defaultFile), 'application');
      config[configType]['default'] = lodash.defaultsDeep({}, config[configType]['expanse'], config[configType]['default']);
    }

    LX.has('conlog') && LX.log('conlog', LT.add({ configType }).toMessage({
      text: ' + load the custom config of ${configType}'
    }));
    config[configType]['names'] = ['default'];
    config[configType]['mixture'] = {};
    if (configDir) {
      let expanseNames = filterConfigBy(ctx, configInfos, includedNames, configType);
      config[configType]['expanse'] = lodash.reduce(expanseNames, function(accum, expanseItem) {
        let configFile = path.join(configDir, expanseItem.join('_') + '.js');
        LX.has('conlog') && LX.log('conlog', LT.add({ configFile }).toMessage({
          text: ' - load the environment config: ${configFile}'
        }));
        let configObj = lodash.defaultsDeep(transformConfig(transCTX, configType, loadConfigFile(ctx, configFile), 'application'), accum);
        if (configObj.disabled) return accum;
        config[configType]['names'].push(expanseItem[1]);
        return configObj;
      }, config[configType]['expanse']);
      config[configType]['mixture'] = lodash.defaultsDeep({}, config[configType]['expanse'], config[configType]['default']);
    }

    LX.has('conlog') && LX.log('conlog', ' - Final config object: %s', util.inspect(config[configType], {depth: 8}));
  });

  if (chores.isFeatureSupported('standardizing-config')) {
    let {plugin: pluginReverseMap, bridge: bridgeReverseMap} = nameResolver.getRelativeAliasMap();
    doAliasMap(ctx, config.sandbox.default, pluginReverseMap, bridgeReverseMap);
    doAliasMap(ctx, config.sandbox.expanse, pluginReverseMap, bridgeReverseMap);
    doAliasMap(ctx, config.sandbox.mixture, pluginReverseMap, bridgeReverseMap);
    stateInspector.collect({config});
  }

  errorHandler.barrier({ invoker: blockRef });

  return config;
}

let loadConfigFile = function(ctx, configFile) {
  let { LX, LT } = ctx || this;
  let opStatus = { type: 'CONFIG', file: configFile };
  let content;
  try {
    content = loader(configFile, { stopWhenError: true });
    opStatus.hasError = false;
    LX.has('conlog') && LX.log('conlog', LT.add({ configFile }).toMessage({
      text: ' - config file ${configFile} loading has done.'
    }));
  } catch(err) {
    if (err.code != 'MODULE_NOT_FOUND') {
      LX.has('conlog') && LX.log('conlog', LT.add({ configFile }).toMessage({
        text: ' - config file ${configFile} loading is failed.'
      }));
      opStatus.hasError = true;
      opStatus.stack = err.stack;
    }
  }
  errorHandler.collect(opStatus);
  return content;
}

let filterConfigBy = function(ctx, configInfos, selectedNames, configType) {
  let arr = {};
  let idx = {};
  selectedNames[configType].forEach(function(name, index) {
    idx[name] = index;
  });
  lodash.forEach(configInfos, function(item) {
    let found = (item.length == 2) && (item[0] == configType) && (item[1].length > 0);
    if (found && idx[item[1]] != null) {
      arr[idx[item[1]]] = item;
    }
  });
  return lodash.values(arr);
}

let resolveConfigDir = function(ctx, appName, appRootDir, configDir, configEnv) {
  let { LX, LT } = ctx || this;
  let dirPath = configDir;
  if (lodash.isEmpty(dirPath)) {
    if (['production'].indexOf(process.env.NODE_ENV) >= 0) {
      dirPath = chores.assertDir(appName);
      if (dirPath == null) {
        LX.has('conlog') && LX.log('conlog', LT.toMessage({
          text: 'Run in production mode, but config directory not found'
        }));
        errorHandler.exit(1);
      }
    } else {
      if (!lodash.isEmpty(appRootDir)) {
        dirPath = path.join(appRootDir, CONFIG_SUBDIR);
      }
    }
  }
  if (!lodash.isEmpty(dirPath) && !lodash.isEmpty(configEnv)) {
    dirPath = path.join(dirPath, configEnv);
  }
  return dirPath;
}

let standardizeNames = function(ctx, cfgLabels) {
  if (lodash.isString(cfgLabels) && cfgLabels.length > 0) {
    cfgLabels = cfgLabels.split(',');
  }
  cfgLabels = lodash.isArray(cfgLabels) ? cfgLabels : [cfgLabels];
  cfgLabels = lodash.filter(cfgLabels, lodash.isString);
  cfgLabels = lodash.map(cfgLabels, lodash.trim);
  cfgLabels = lodash.filter(cfgLabels, lodash.negate(lodash.isEmpty));
  return cfgLabels;
}

let transformConfig = function(ctx, configType, configData, moduleType, moduleName, modulePresets) {
  let { LX, LT, pluginAliasMap, bridgeAliasMap } = ctx || this;
  if (configType === CONFIG_SANDBOX_NAME) {
    configData = convertSandboxConfig(ctx, configData, moduleType, moduleName, modulePresets);
    configData = doAliasMap(ctx, configData, pluginAliasMap, bridgeAliasMap);
  }
  return configData;
}

let convertSandboxConfig = function(ctx, sandboxConfig, moduleType, moduleName, modulePresets) {
  let { LX, LT } = ctx || this;
  if (lodash.isEmpty(sandboxConfig) || !lodash.isObject(sandboxConfig)) {
    return sandboxConfig;
  }
  // convert old bridge structures
  if (chores.isFeatureSupported(['bridge-full-ref'])) {
    let tags = lodash.get(modulePresets, ['configTags'], []);
    tags = lodash.isArray(tags) ? tags : [tags];
    let cfgBridges = sandboxConfig.bridges;
    if (lodash.isObject(cfgBridges) && !cfgBridges.__status__ && tags.indexOf('bridge[dialect-bridge]') >= 0) {
      let newBridges = { __status__: true };
      let traverseBackward = function(cfgBridges, newBridges) {
        lodash.forOwn(cfgBridges, function(bridgeCfg, cfgName) {
          if (lodash.isObject(bridgeCfg) && !lodash.isEmpty(bridgeCfg)) {
            if (moduleType === 'application') {
              newBridges[cfgName] = newBridges[cfgName] || {};
              lodash.merge(newBridges[cfgName], bridgeCfg);
            } else
            if (moduleType === 'plugin') {
              moduleName = moduleName || '*';
              let bridgeNames = lodash.keys(bridgeCfg);
              if (bridgeNames.length === 1) {
                let bridgeName = bridgeNames[0];
                newBridges[bridgeName] = newBridges[bridgeName] || {};
                newBridges[bridgeName][moduleName] = newBridges[bridgeName][moduleName] || {};
                if (lodash.isObject(bridgeCfg[bridgeName])) {
                  newBridges[bridgeName][moduleName][cfgName] = bridgeCfg[bridgeName];
                }
              }
            }
          }
        });
      }
      traverseBackward(cfgBridges, newBridges);
      sandboxConfig.bridges = newBridges;
    }
  }
  return sandboxConfig;
}

let doAliasMap = function(ctx, sandboxConfig, pluginAliasMap, bridgeAliasMap) {
  let { LX, LT } = ctx || this;
  if (chores.isFeatureSupported(['standardizing-config'])) {
    if (sandboxConfig && lodash.isObject(sandboxConfig.plugins)) {
      let oldPlugins = sandboxConfig.plugins;
      let newPlugins = {};
      lodash.forOwn(oldPlugins, function(oldPlugin, oldPluginName) {
        let newPluginName = pluginAliasMap[oldPluginName] || oldPluginName;
        newPlugins[newPluginName] = oldPlugin;
      });
      sandboxConfig.plugins = newPlugins;
    }
  }
  if (chores.isFeatureSupported(['standardizing-config', 'bridge-full-ref'])) {
    if (sandboxConfig && lodash.isObject(sandboxConfig.bridges)) {
      let oldBridges = sandboxConfig.bridges;
      let newBridges = {};
      lodash.forOwn(oldBridges, function(oldBridge, oldBridgeName) {
        let newBridgeName = bridgeAliasMap[oldBridgeName] || oldBridgeName;
        if (newBridgeName) {
          if (lodash.isObject(oldBridge)) {
            newBridges[newBridgeName] = {};
            lodash.forOwn(oldBridge, function(oldPlugin, oldPluginName) {
              let newPluginName = pluginAliasMap[oldPluginName] || oldPluginName;
              newBridges[newBridgeName][newPluginName] = oldPlugin;
            });
          } else {
            newBridges[newBridgeName] = oldBridge;
          }
        }
      });
      sandboxConfig.bridges = newBridges;
    }
  }
  return sandboxConfig;
}
