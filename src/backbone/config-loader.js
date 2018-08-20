'use strict';

const lodash = require('lodash');
const util = require('util');
const path = require('path');

const chores = require('../utils/chores');
const constx = require('../utils/constx');
const loader = require('../utils/loader');
const envbox = require('../utils/envbox');
const nodash = require('../utils/nodash');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

const CONFIG_SUBDIR = '/config';
const CONFIG_VAR_NAMES = [ 'PROFILE',  'SANDBOX', 'CONFIG_DIR', 'CONFIG_ENV' ];
const CONFIG_PROFILE_NAME = 'profile';
const CONFIG_SANDBOX_NAME = 'sandbox';
const RELOADING_FORCED = true;

function ConfigLoader(params={}) {
  let {appName, appOptions, appRef, devebotRef, pluginRefs, bridgeRefs, issueInspector, stateInspector, nameResolver} = params;
  let loggingWrapper = new LoggingWrapper(blockRef);
  let LX = loggingWrapper.getLogger();
  let LT = loggingWrapper.getTracer();
  let CTX = { LX, LT, issueInspector, stateInspector, nameResolver };

  let label = chores.stringLabelCase(appName);

  LX.has('silly') && LX.log('silly', LT.add({ appName, appOptions, appRef, devebotRef, pluginRefs, bridgeRefs, label }).toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + Config of application (${appName}) is loaded in name: ${label}'
  }));

  appOptions = appOptions || {};

  this.load = function() {
    return loadConfig.bind(null, CTX, appName, appOptions, appRef, devebotRef, pluginRefs, bridgeRefs)
        .apply(null, CONFIG_VAR_NAMES.map(readVariable.bind(null, CTX, label)));
  }

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
    value = envbox.getEnv(varLabel);
    LX.has('conlog') && LX.log('conlog', LT.add({ label: varLabel, value }).toMessage({
      text: ' - Get value of ${label}: ${value}'
    }));
    if (value) break;
  }
  LX.has('conlog') && LX.log('conlog', LT.add({ label: varLabels[0], value }).toMessage({
    text: ' - Final value of ${label}: ${value}'
  }));
  return value;
}

let loadConfig = function(ctx, appName, appOptions, appRef, devebotRef, pluginRefs, bridgeRefs, profileName, sandboxName, customDir, customEnv) {
  let { LX, LT, issueInspector, stateInspector, nameResolver } = ctx || this;
  appOptions = appOptions || {};

  const ALIASES_OF = {};
  ALIASES_OF[CONFIG_PROFILE_NAME] = lodash.clone(envbox.getEnv('CONFIG_PROFILE_ALIASES'));
  ALIASES_OF[CONFIG_PROFILE_NAME].unshift(CONFIG_PROFILE_NAME);
  ALIASES_OF[CONFIG_SANDBOX_NAME] = lodash.clone(envbox.getEnv('CONFIG_SANDBOX_ALIASES'));
  ALIASES_OF[CONFIG_SANDBOX_NAME].unshift(CONFIG_SANDBOX_NAME);
  LX.has('silly') && LX.log('silly', LT.add({ aliasesOf: ALIASES_OF }).toMessage({
    tags: [ blockRef, 'config-dir', 'aliases-of' ],
    text: ' - configType aliases mapping: ${aliasesOf}'
  }));
  const CONFIG_TYPES = [CONFIG_PROFILE_NAME, CONFIG_SANDBOX_NAME];

  let {plugin: pluginAliasMap, bridge: bridgeAliasMap} = nameResolver.getAbsoluteAliasMap();
  let transCTX = { LX, LT, pluginAliasMap, bridgeAliasMap, CONFIG_PROFILE_NAME, CONFIG_SANDBOX_NAME };

  let libRefs = lodash.values(pluginRefs);
  if (devebotRef) {
    libRefs.push(devebotRef);
  }

  let appRootDir = null;
  if (appRef && lodash.isString(appRef.path)) {
    appRootDir = appRef.path;
  };

  let config = {};

  let defaultConfigDir = appRootDir ? path.join(appRootDir, CONFIG_SUBDIR) : null;
  LX.has('silly') && LX.log('silly', LT.add({ configDir: defaultConfigDir }).toMessage({
    tags: [ blockRef, 'config-dir', 'internal-config-dir' ],
    text: ' - internal configDir: ${configDir}'
  }));

  let externalConfigDir = resolveConfigDir(ctx, appName, appRootDir, customDir, customEnv);
  LX.has('silly') && LX.log('silly', LT.add({ configDir: externalConfigDir }).toMessage({
    tags: [ blockRef, 'config-dir', 'external-config-dir' ],
    text: ' - external configDir: ${configDir}'
  }));

  let includedNames = {};
  includedNames[CONFIG_PROFILE_NAME] = standardizeNames(ctx, profileName);
  includedNames[CONFIG_SANDBOX_NAME] = standardizeNames(ctx, sandboxName);

  let appProfiles = standardizeNames(ctx, appOptions.privateProfile || appOptions.privateProfiles);
  includedNames[CONFIG_PROFILE_NAME] = lodash.concat(
    lodash.difference(includedNames[CONFIG_PROFILE_NAME], appProfiles), appProfiles);

  let appSandboxes = standardizeNames(ctx, appOptions.privateSandbox || appOptions.privateSandboxes);
  includedNames[CONFIG_SANDBOX_NAME] = lodash.concat(
    lodash.difference(includedNames[CONFIG_SANDBOX_NAME], appSandboxes), appSandboxes);

  LX.has('conlog') && LX.log('conlog', LT.add({ includedNames }).toMessage({
    text: ' + included names: ${includedNames}'
  }));

  function loadApplicationConfig(configType, configDir) {
    if (configDir) {
      LX.has('conlog') && LX.log('conlog', LT.add({ configType, configDir }).toMessage({
        text: ' + load the "${configType}" configuration in "${configDir}"'
      }));
      let configFiles = chores.filterFiles(configDir, '.*\.js');
      let configInfos = lodash.map(configFiles, function(file) {
        if (false) {
          return file.replace('.js', '').split(/_(.+)/).filter(function(sub) {
            return sub.length > 0;
          });
        }
        return file.replace('.js', '').replace(/[_]/,'&').split('&');
      });
      LX.has('conlog') && LX.log('conlog', LT.add({ configInfos }).toMessage({
        text: ' - parsing configFiles result: ${configInfos}'
      }));

      LX.has('conlog') && LX.log('conlog', LT.add({ configType }).toMessage({
        text: ' - load the application default config of "${configType}"'
      }));
      for(let i in ALIASES_OF[configType]) {
        let defaultFile = path.join(configDir, ALIASES_OF[configType][i] + '.js');
        if (chores.fileExists(defaultFile)) {
          config[configType]['expanse'] = transformConfig(transCTX, configType, loadConfigFile(ctx, defaultFile), 'application');
          break;
        }
      }
      config[configType]['default'] = lodash.defaultsDeep({}, config[configType]['expanse'], config[configType]['default']);

      LX.has('conlog') && LX.log('conlog', LT.add({ configType }).toMessage({
        text: ' - load the application customized config of "${configType}"'
      }));
      let expanseNames = filterConfigBy(ctx, configInfos, includedNames, configType, ALIASES_OF);
      LX.has('conlog') && LX.log('conlog', LT.add({ expanseNames }).toMessage({
        text: ' + expanded names: ${expanseNames}'
      }));
      config[configType]['expanse'] = config[configType]['expanse'] || {};
      config[configType]['expanse'] = lodash.reduce(expanseNames, function(accum, expanseItem) {
        let configFile = path.join(configDir, expanseItem.join('_') + '.js');
        let configObj = lodash.defaultsDeep(transformConfig(transCTX, configType, loadConfigFile(ctx, configFile), 'application'), accum);
        if (configObj.disabled) return accum;
        config[configType]['names'].push(expanseItem[1]);
        return configObj;
      }, config[configType]['expanse']);
      config[configType]['mixture'] = config[configType]['mixture'] || {};
      config[configType]['mixture'] = lodash.defaultsDeep(config[configType]['expanse'], config[configType]['mixture'], config[configType]['default']);
    }
  }

  CONFIG_TYPES.forEach(function(configType) {
    config[configType] = config[configType] || {};

    LX.has('conlog') && LX.log('conlog', LT.toMessage({
      text: ' + load the default config from plugins & framework'
    }));
    lodash.forEach(libRefs, function(libRef) {
      if (libRef.presets && chores.isUpgradeSupported('presets')) {
        LX.has('conlog') && LX.log('conlog', LT.add(libRef).toMessage({
          text: ' - Presets of ${type}[${name}]: ${presets}'
        }));
      }
      let libRootDir = libRef.path;
      let libType = libRef.type || 'plugin';
      let libName = libRef.name;
      for(let i in ALIASES_OF[configType]) {
        let defaultFile = path.join(libRootDir, CONFIG_SUBDIR, ALIASES_OF[configType][i] + '.js');
        if (chores.fileExists(defaultFile)) {
          config[configType]['default'] = lodash.defaultsDeep(config[configType]['default'],
              transformConfig(transCTX, configType, loadConfigFile(ctx, defaultFile), libType, libName, libRef.presets));
          break;
        }
      }
    });

    config[configType]['names'] = ['default'];
    config[configType]['mixture'] = {};

    loadApplicationConfig(configType, defaultConfigDir);
    if (externalConfigDir != defaultConfigDir) {
      loadApplicationConfig(configType, externalConfigDir);
    }

    LX.has('conlog') && LX.log('conlog', ' - Final config object: %s', util.inspect(config[configType], {depth: 8}));
  });

  if (chores.isUpgradeSupported('standardizing-config')) {
    let {plugin: pluginReverseMap, bridge: bridgeReverseMap} = nameResolver.getRelativeAliasMap();
    doAliasMap(ctx, config.sandbox.default, pluginReverseMap, bridgeReverseMap);
    doAliasMap(ctx, config.sandbox.expanse, pluginReverseMap, bridgeReverseMap);
    doAliasMap(ctx, config.sandbox.mixture, pluginReverseMap, bridgeReverseMap);
    stateInspector.collect({config});
  }

  issueInspector.barrier({ invoker: blockRef, footmark: 'config-file-loading' });

  return config;
}

let loadConfigFile = function(ctx, configFile) {
  let { LX, LT, issueInspector } = ctx || this;
  let opStatus = { type: 'CONFIG', file: configFile };
  let content;
  try {
    LX.has('conlog') && LX.log('conlog', LT.add({ configFile }).toMessage({
      text: ' - load config file: "${configFile}"'
    }));
    content = loader(configFile, { stopWhenError: true });
    opStatus.hasError = false;
    LX.has('conlog') && LX.log('conlog', LT.add({ configFile }).toMessage({
      text: ' - loading config file: "${configFile}" has done.'
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
  issueInspector.collect(opStatus);
  return RELOADING_FORCED ? lodash.cloneDeep(content) : content;
}

let filterConfigBy = function(ctx, configInfos, selectedNames, configType, aliasesOf) {
  let arr = {};
  let idx = {};
  selectedNames[configType].forEach(function(name, index) {
    idx[name] = index;
  });
  lodash.forEach(configInfos, function(item) {
    let found = (item.length == 2) && (aliasesOf[configType].indexOf(item[0]) >= 0) && (item[1].length > 0);
    if (found && idx[item[1]] != null) {
      arr[idx[item[1]]] = item;
    }
  });
  return lodash.values(arr);
}

let resolveConfigDir = function(ctx, appName, appRootDir, configDir, configEnv) {
  let { LX, LT, issueInspector } = ctx || this;
  let dirPath = configDir;
  if (lodash.isEmpty(dirPath)) {
    if (['production'].indexOf(process.env.NODE_ENV) >= 0) {
      dirPath = chores.assertDir(appName);
      if (dirPath == null) {
        LX.has('conlog') && LX.log('conlog', LT.toMessage({
          text: 'Run in production mode, but config directory not found'
        }));
        issueInspector.exit(1);
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
  cfgLabels = nodash.arrayify(cfgLabels);
  cfgLabels = lodash.filter(cfgLabels, lodash.isString);
  cfgLabels = lodash.map(cfgLabels, lodash.trim);
  cfgLabels = lodash.filter(cfgLabels, lodash.negate(lodash.isEmpty));
  return cfgLabels;
}

let transformConfig = function(ctx, configType, configData, moduleType, moduleName, modulePresets) {
  let { LX, LT, pluginAliasMap, bridgeAliasMap, CONFIG_SANDBOX_NAME } = ctx || this;
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
  if (chores.isUpgradeSupported(['bridge-full-ref','presets'])) {
    let tags = nodash.arrayify(lodash.get(modulePresets, ['configTags'], []));
    let cfgBridges = sandboxConfig.bridges;
    let loadable = RELOADING_FORCED || !(cfgBridges && cfgBridges.__status__);
    if (lodash.isObject(cfgBridges) && tags.indexOf('bridge[dialect-bridge]') >= 0 && loadable) {
      let newBridges = RELOADING_FORCED ? {} : { __status__: true };
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
  if (chores.isUpgradeSupported(['standardizing-config'])) {
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
  if (chores.isUpgradeSupported(['standardizing-config', 'bridge-full-ref'])) {
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
