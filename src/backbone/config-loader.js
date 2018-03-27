'use strict';

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var chores = require('../utils/chores');
var constx = require('../utils/constx');
var loader = require('../utils/loader');
var errorHandler = require('./error-handler').instance;
var LoggingWrapper = require('./logging-wrapper');

var CONFIG_SUBDIR = '/config';
var CONFIG_PROFILE_NAME = process.env.DEVEBOT_CONFIG_PROFILE_NAME || 'profile';
var CONFIG_SANDBOX_NAME = process.env.DEVEBOT_CONFIG_SANDBOX_NAME || 'sandbox';
var CONFIG_TYPES = [CONFIG_PROFILE_NAME, CONFIG_SANDBOX_NAME];
var CONFIG_VAR_NAMES = { ctxName: 'PROFILE', boxName: 'SANDBOX', cfgDir: 'CONFIG_DIR', cfgEnv: 'CONFIG_ENV' };

function Loader(appName, appOptions, appRef, libRefs) {
  var blockRef = chores.getBlockRef(__filename);
  var loggingWrapper = new LoggingWrapper(blockRef);
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();
  var CTX = { logger: LX, tracer: LT };

  var label = chores.stringLabelCase(appName);

  LX.has('silly') && LX.log('silly', LT.add({
    appName: appName,
    appOptions: appOptions,
    appRef: appRef,
    libRefs: libRefs,
    label: label
  }).toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + Config of application (${appName}) is loaded in name: ${label}'
  }));

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  var loadConfig = function(appName, appOptions, appRef, libRefs, profileName, sandboxName, customDir, customEnv) {
    appOptions = appOptions || {};

    var appRootDir = null;
    if (appRef && lodash.isString(appRef.path)) {
      appRootDir = path.dirname(appRef.path);
    };

    var config = {};

    var configDir = resolveConfigDir(appName, appRootDir, customDir, customEnv);

    LX.has('silly') && LX.log('silly', LT.add({
      configDir: configDir
    }).toMessage({
      tags: [ blockRef, 'config-dir' ],
      text: ' - configDir: ${configDir}'
    }));

    var configFiles = [];
    if (configDir) {
      configFiles = chores.filterFiles(configDir, '.*\.js');
    }
    var configInfos = lodash.map(configFiles, function(file) {
      return file.replace('.js', '').split(/[_]/);
    });

    var includedNames = {};
    includedNames[CONFIG_PROFILE_NAME] = standardizeNames(profileName);
    includedNames[CONFIG_SANDBOX_NAME] = standardizeNames(sandboxName);

    var appProfiles = standardizeNames(appOptions.privateProfile || appOptions.privateProfiles);
    includedNames[CONFIG_PROFILE_NAME] = lodash.concat(
      lodash.difference(includedNames[CONFIG_PROFILE_NAME], appProfiles), appProfiles);

    var appSandboxes = standardizeNames(appOptions.privateSandbox || appOptions.privateSandboxes);
    includedNames[CONFIG_SANDBOX_NAME] = lodash.concat(
      lodash.difference(includedNames[CONFIG_SANDBOX_NAME], appSandboxes), appSandboxes);

    CONFIG_TYPES.forEach(function(configType) {
      config[configType] = config[configType] || {};

      if (configDir) {
        var defaultFile = path.join(configDir, configType + '.js');
        LX.has('conlog') && LX.log('conlog', LT.add({
          defaultFile: defaultFile
        }).toMessage({
          text: ' + load the default config: ${defaultFile}'
        }));
        config[configType]['default'] = transformConfig(CTX, configType, loadConfigFile(defaultFile), 'application');
      }

      LX.has('conlog') && LX.log('conlog', LT.toMessage({
        text: ' + load the default config from plugins'
      }));
      lodash.forEach(libRefs, function(libRef) {
        var libRootDir = path.dirname(libRef.path);
        var libType = libRef.type || 'plugin';
        var libName = libRef.name;
        var defaultFile = path.join(libRootDir, CONFIG_SUBDIR, configType + '.js');
        config[configType]['default'] = lodash.defaultsDeep(config[configType]['default'],
            transformConfig(CTX, configType, loadConfigFile(defaultFile), libType, libName));
      });

      LX.has('conlog') && LX.log('conlog', LT.add({
        configType: configType
      }).toMessage({
        text: ' + load the custom config of ${configType}'
      }));
      config[configType]['mixture'] = {};

      var mixtureNames = filterConfigBy(configInfos, includedNames, configType);

      config[configType]['names'] = ['default'];
      if (configDir) {
        config[configType]['mixture'] = lodash.reduce(mixtureNames, function(accum, mixtureItem) {
          var configFile = path.join(configDir, mixtureItem.join('_') + '.js');
          LX.has('conlog') && LX.log('conlog', LT.add({
            configFile: configFile
          }).toMessage({
            text: ' - load the environment config: ${configFile}'
          }));
          var configObj = lodash.defaultsDeep(transformConfig(CTX, configType, loadConfigFile(configFile), 'application'), accum);
          if (configObj.disabled) return accum;
          config[configType]['names'].push(mixtureItem[1]);
          return configObj;
        }, lodash.cloneDeep(config[configType]['default']));
      }

      LX.has('conlog') && LX.log('conlog', ' - environment config object: %s',
          util.inspect(config[configType], {depth: 8}));
    });

    errorHandler.barrier({ invoker: blockRef });

    return config;
  };

  var loadConfigFile = function(configFile) {
    var opStatus = { type: 'CONFIG', file: configFile };
    var content;
    try {
      content = loader(configFile, { stopWhenError: true });
      opStatus.hasError = false;
      LX.has('conlog') && LX.log('conlog', LT.add({
        configFile: configFile
      }).toMessage({
        text: ' - config file ${configFile} loading has done.'
      }));
    } catch(err) {
      if (err.code != 'MODULE_NOT_FOUND') {
        LX.has('conlog') && LX.log('conlog', LT.add({
          configFile: configFile
        }).toMessage({
          text: ' - config file ${configFile} loading is failed.'
        }));
        opStatus.hasError = true;
        opStatus.stack = err.stack;
      }
    }
    errorHandler.collect(opStatus);
    return content;
  }

  var readVariable = function readVariable(appLabel, varName) {
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

  var resolveConfigDir = function(appName, appRootDir, configDir, configEnv) {
    var dirPath = configDir;
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

  var filterConfigBy = function(configInfos, selectedNames, configType) {
    var arr = {};
    var idx = {};
    selectedNames[configType].forEach(function(name, index) {
      idx[name] = index;
    });
    lodash.forEach(configInfos, function(item) {
      var found = (item.length == 2) && (item[0] == configType) && (item[1].length > 0);
      if (found && idx[item[1]] != null) {
        arr[idx[item[1]]] = item;
      }
    });
    return lodash.values(arr);
  }

  var standardizeNames = function(cfgLabels) {
    if (lodash.isString(cfgLabels) && cfgLabels.length > 0) {
      cfgLabels = cfgLabels.split(',');
    }
    cfgLabels = lodash.isArray(cfgLabels) ? cfgLabels : [cfgLabels];
    cfgLabels = lodash.filter(cfgLabels, lodash.isString);
    cfgLabels = lodash.map(cfgLabels, lodash.trim);
    cfgLabels = lodash.filter(cfgLabels, lodash.negate(lodash.isEmpty));
    return cfgLabels;
  }

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  appOptions = appOptions || {};

  var config = loadConfig
      .bind(null, appName, appOptions, appRef, libRefs)
      .apply(null, Object.keys(CONFIG_VAR_NAMES).map(function(varName) {
        return readVariable(label, CONFIG_VAR_NAMES[varName]);
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

module.exports = Loader;

let transformConfig = function(ctx, configType, configData, moduleType, moduleName) {
  if (!chores.isFeatureSupported('bridge-full-ref')) {
    return configData;
  }
  if (configType === CONFIG_SANDBOX_NAME) {
    return transformSandboxConfig(ctx, configData, moduleType, moduleName);
  }
  return configData;
}

let transformSandboxConfig = function(ctx, sandboxConfig, moduleType, moduleName) {
  let { logger: LX, tracer: LT } = ctx || this;
  if (lodash.isEmpty(sandboxConfig) || !lodash.isObject(sandboxConfig)) {
    return sandboxConfig;
  }
  if (lodash.isObject(sandboxConfig.bridges) && !sandboxConfig.bridges.__status__) {
    let cfgBridges = sandboxConfig.bridges || {};
    let newBridges = { __status__: true };
    var traverseBackward = function(cfgBridges, newBridges) {
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
  return sandboxConfig;
}
