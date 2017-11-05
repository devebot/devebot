'use strict';

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var debugx = require('../utils/debug.js')('devebot:configLoader');
var errorHandler = require('./error-handler').instance;

var CONFIG_SUBDIR = '/config';
var CONFIG_CONTEXT_NAME = process.env.NODE_DEVEBOT_CONFIG_CONTEXT_NAME || 'profile';
var CONFIG_SANDBOX_NAME = process.env.NODE_DEVEBOT_CONFIG_SANDBOX_NAME || 'sandbox';
var CONFIG_NAMES = [CONFIG_CONTEXT_NAME, CONFIG_SANDBOX_NAME];

function Loader(appName, appRootDir, libRootDirs) {
  var label = chores.stringLabelCase(appName);
  debugx.enabled && debugx(' + Config of application (%s) is loaded in name: %s', appName, label);

  var customDirLabel = util.format('NODE_%s_CONFIG_DIR', label);
  var customDir = process.env[customDirLabel] || process.env.NODE_DEVEBOT_CONFIG_DIR;
  if (!process.env[customDirLabel]) {
    debugx.enabled && debugx(' - %s not found. Use NODE_DEVEBOT_CONFIG_DIR instead', customDirLabel);
  }

  var customEnvLabel = util.format('NODE_%s_CONFIG_ENV', label);
  var customEnv = process.env[customEnvLabel] || process.env.NODE_DEVEBOT_CONFIG_ENV;
  if (!process.env[customEnvLabel]) {
    debugx.enabled && debugx(' - %s not found. Use NODE_DEVEBOT_CONFIG_ENV instead', customEnvLabel);
  }

  var contextLabel = util.format('NODE_%s_PROFILE', label);
  var contextName = process.env[contextLabel] || process.env.NODE_DEVEBOT_PROFILE;
  if (!process.env[contextLabel]) {
    debugx.enabled && debugx(' - %s not found. Use NODE_DEVEBOT_PROFILE instead', contextLabel);
  }

  var sandboxLabel = util.format('NODE_%s_SANDBOX', label);
  var sandboxName = process.env[sandboxLabel] || process.env.NODE_DEVEBOT_SANDBOX;
  if (!process.env[sandboxLabel]) {
    debugx.enabled && debugx(' - %s not found. Use NODE_DEVEBOT_SANDBOX instead', sandboxLabel);
  }

  debugx.enabled && debugx(" - %s's value: %s", contextLabel, contextName);
  debugx.enabled && debugx(" - %s's value: %s", sandboxLabel, sandboxName);

  var config = loadConfig(appName, appRootDir, libRootDirs, contextName, sandboxName, customDir, customEnv);

  Object.defineProperty(this, 'config', {
    get: function() { return config },
    set: function(value) {}
  });
}

var loadConfig = function(appName, appRootDir, libRootDirs, contextName, sandboxName, customDir, customEnv) {
  libRootDirs = libRootDirs || [];

  var config = {};

  var configDir = resolveConfigDir(customDir, appName, appRootDir, customEnv);
  if (configDir === null) {
    debugx.enabled && debugx('Run in production mode, but configDir not found');
    errorHandler.exit(1);
  }

  var stagingFiles = chores.filterFiles(configDir, '.*\.js');
  var stagingArray = lodash.map(stagingFiles, function(file) {
    return file.replace('.js', '').split(/[_]/);
  });

  var includedNames = {};
  CONFIG_NAMES.forEach(function(configName) {
    includedNames[configName] = [];
  });

  if (lodash.isString(contextName) && contextName.length > 0) {
    includedNames[CONFIG_CONTEXT_NAME].push(contextName);
  }

  if (lodash.isString(sandboxName) && sandboxName.length > 0) {
    includedNames[CONFIG_SANDBOX_NAME] = sandboxName.split(',');
  }

  CONFIG_NAMES.forEach(function(configName) {
    config[configName] = {};

    var defaultFile = path.join(configDir, configName + '.js');

    debugx.enabled && debugx(' + load the default config: %s', defaultFile);
    config[configName]['default'] = loader(defaultFile);

    libRootDirs.forEach(function(libRootDir) {
      defaultFile = path.join(libRootDir, CONFIG_SUBDIR, configName + '.js');
      config[configName]['default'] = lodash.defaultsDeep(config[configName]['default'], loader(defaultFile));
    });

    debugx.enabled && debugx(' + load the custom config of %s', configName);
    config[configName]['staging'] = {};

    var stagingNames = lodash.filter(stagingArray, function(item) {
      var found = (item.length == 2) && (item[0] == configName) && (item[1].length > 0);

      if (constx.CONFIG.MUST_SPECIFY_IN_ENV || (includedNames[configName].length > 0)) {
        found = found && (lodash.indexOf(includedNames[configName], item[1]) >= 0);
      }

      return found;
    });

    lodash.forEach(stagingNames, function(stagingItem) {
      var stagingFile = path.join(configDir, stagingItem.join('_') + '.js');
      debugx.enabled && debugx(' - load the environment config: %s', stagingFile);
      var stagingCfg = lodash.defaultsDeep(loader(stagingFile), config[configName]['default']);
      if ((includedNames[configName].length > 0) || !(stagingCfg.disabled)) {
        var stagingName = stagingItem[1];
        config[configName]['staging'][stagingName] = stagingCfg;
      }
    });

    if (configName == CONFIG_CONTEXT_NAME) {
      var contextList = lodash.values(config[configName]['staging']);
      if (contextList.length > 0) {
        config[configName]['staging'] = contextList[0];
      } else {
        config[configName]['staging'] = config[configName]['default'];
      }
    }

    if (configName == CONFIG_SANDBOX_NAME) {
      if (lodash.isEmpty(config[configName]['staging'])) {
        config[configName]['staging']['default'] = config[configName]['default'];
      }
    }

    debugx.enabled && debugx(' - environment config object: %s', util.inspect(config[configName], {depth: 2}));
  });

  return config;
};

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

module.exports = Loader;
