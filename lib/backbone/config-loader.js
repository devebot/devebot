'use strict';

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var errorHandler = require('./error-handler').instance;
var LoggingWrapper = require('./logging-wrapper');

var CONFIG_SUBDIR = '/config';
var CONFIG_PROFILE_NAME = process.env.NODE_DEVEBOT_CONFIG_PROFILE_NAME || 'profile';
var CONFIG_SANDBOX_NAME = process.env.NODE_DEVEBOT_CONFIG_SANDBOX_NAME || 'sandbox';
var CONFIG_TYPES = [CONFIG_PROFILE_NAME, CONFIG_SANDBOX_NAME];
var CONFIG_VAR_NAMES = { ctxName: 'PROFILE', boxName: 'SANDBOX', cfgDir: 'CONFIG_DIR', cfgEnv: 'CONFIG_ENV' };

function Loader(appName, appRootDir, libRootDirs) {
  var loggingWrapper = new LoggingWrapper(chores.getBlockRef(__filename));
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  var label = chores.stringLabelCase(appName);

  LX.has('conlog') && LX.log('conlog', LT.add({
    appName: appName,
    label: label
  }).stringify({
    tags: [ 'constructor-begin' ],
    text: ' + Config of application ({appName}) is loaded in name: {label}',
    reset: true
  }));

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  var loadConfig = function(appName, appRootDir, libRootDirs, profileName, sandboxName, customDir, customEnv, specificSandbox) {
    libRootDirs = libRootDirs || [];

    var config = {};

    var configDir = resolveConfigDir(customDir, appName, appRootDir, customEnv);

    LX.has('conlog') && LX.log('conlog', LT.add({
      configDir: configDir
    }).toMessage({
      text: ' - configDir: {configDir}',
      reset: true
    }));

    if (configDir === null) {
      LX.has('conlog') && LX.log('conlog', 'Run in production mode, but configDir not found');
      errorHandler.exit(1);
    }

    var configFiles = chores.filterFiles(configDir, '.*\.js');
    var configInfos = lodash.map(configFiles, function(file) {
      return file.replace('.js', '').split(/[_]/);
    });

    var includedNames = {};
    CONFIG_TYPES.forEach(function(configType) {
      includedNames[configType] = [];
    });

    if (lodash.isString(profileName) && profileName.length > 0) {
      includedNames[CONFIG_PROFILE_NAME] = profileName.split(',');
    }

    if (lodash.isString(sandboxName) && sandboxName.length > 0) {
      includedNames[CONFIG_SANDBOX_NAME] = sandboxName.split(',');
    }

    var tmpSandboxes = specificSandbox;
    if (lodash.isString(tmpSandboxes) && tmpSandboxes.length > 0) {
      tmpSandboxes = tmpSandboxes.split(',');
    }
    if (!lodash.isArray(tmpSandboxes)) tmpSandboxes = [tmpSandboxes];
    tmpSandboxes = lodash.filter(tmpSandboxes, function(sandboxName) {
      return lodash.isString(sandboxName);
    });

    includedNames[CONFIG_SANDBOX_NAME] = lodash.concat(
      lodash.difference(includedNames[CONFIG_SANDBOX_NAME], tmpSandboxes), tmpSandboxes);

    var filterBy = function(configType, configInfos) {
      var arr = {};
      var idx = {};
      includedNames[configType].forEach(function(name, index) {
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

    CONFIG_TYPES.forEach(function(configType) {
      config[configType] = config[configType] || {};

      var defaultFile = path.join(configDir, configType + '.js');
      LX.has('conlog') && LX.log('conlog', ' + load the default config: %s', defaultFile);
      config[configType]['default'] = loadConfigFile(defaultFile);

      LX.has('conlog') && LX.log('conlog', ' + load the default config from plugins');
      libRootDirs.forEach(function(libRootDir) {
        defaultFile = path.join(libRootDir, CONFIG_SUBDIR, configType + '.js');
        config[configType]['default'] = lodash.defaultsDeep(config[configType]['default'],
          loadConfigFile(defaultFile));
      });

      LX.has('conlog') && LX.log('conlog', ' + load the custom config of %s', configType);
      config[configType]['staging'] = {};

      var stagingNames = filterBy(configType, configInfos);

      config[configType]['names'] = ['default'];
      config[configType]['staging'] = lodash.reduce(stagingNames, function(accum, stagingItem) {
        var configFile = path.join(configDir, stagingItem.join('_') + '.js');
        LX.has('conlog') && LX.log('conlog', ' - load the environment config: %s', configFile);
        var configObj = lodash.defaultsDeep(loadConfigFile(configFile), accum);
        if (configObj.disabled) return accum;
        config[configType]['names'].push(stagingItem[1]);
        return configObj;
      }, lodash.cloneDeep(config[configType]['default']));

      LX.has('conlog') && LX.log('conlog', ' - environment config object: %s',
          util.inspect(config[configType], {depth: 8}));
    });

    errorHandler.barrier({ exitOnError: true, verbose: true });

    return config;
  };

  var loadConfigFile = function(configFile) {
    var opStatus = { type: 'CONFIG', file: configFile };
    var content;
    try {
      content = loader(configFile, { stopWhenError: true });
      opStatus.hasError = false;
      LX.has('conlog') && LX.log('conlog', ' - config file %s loading has done.', configFile);
    } catch(err) {
      if (err.code != 'MODULE_NOT_FOUND') {
        LX.has('conlog') && LX.log('conlog', ' - config file %s loading is failed.', configFile);
        opStatus.hasError = true;
        opStatus.stack = err.stack;
      }
    }
    errorHandler.collect(opStatus);
    return content;
  }

  var readVariable = function(appLabel, varName) {
    var varLabel = util.format('NODE_%s_%s', appLabel, CONFIG_VAR_NAMES[varName]);
    if (!process.env[varLabel]) {
      LX.has('conlog') && LX.log('conlog', ' - %s not found. Use NODE_DEVEBOT_%s instead', varLabel, CONFIG_VAR_NAMES[varName]);
    }
    var value = process.env[varLabel] || process.env['NODE_DEVEBOT_' + CONFIG_VAR_NAMES[varName]];
    LX.has('conlog') && LX.log('conlog', " - %s's value: %s", varLabel, value);
    return value;
  }

  var resolveConfigDir = function(configDir, appName, appRootDir, configEnv) {
    var dirPath = configDir;
    if (lodash.isEmpty(dirPath)) {
      if (['production'].indexOf(process.env.NODE_ENV) >= 0) {
        dirPath = chores.assertDir(appName);
      } else {
        dirPath = path.join(appRootDir, CONFIG_SUBDIR);
      }
    }
    if (!lodash.isEmpty(configEnv)) {
      dirPath = path.join(dirPath, configEnv);
    }
    return dirPath;
  }

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  var config = loadConfig.bind(null, appName, appRootDir, libRootDirs)
      .apply(null, Object.keys(CONFIG_VAR_NAMES).map(function(varName) {
        return readVariable(label, varName);
      }));

  Object.defineProperty(this, 'config', {
    get: function() { return config },
    set: function(value) {}
  });

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

module.exports = Loader;
