'use strict';

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var debugx = require('../utils/debug.js')('devebot:configLoader');

var configNames = ['general', 'profile', 'sandbox'];

function Loader(appName, appRootDir, libRootDirs) {
  var label = chores.stringLabelCase(appName);
  debugx.enabled && debugx(' + Config of application (%s) is loaded in staging: %s', appName, label);

  var PROFILE_LABEL = util.format('NODE_%s_PROFILE', label);
  var PROFILE_VALUE = process.env[PROFILE_LABEL] || process.env.NODE_DEVEBOT_PROFILE;
  if (!process.env[PROFILE_LABEL]) {
    debugx.enabled && debugx(' - %s not found. Use NODE_DEVEBOT_PROFILE instead', PROFILE_LABEL);
  }

  var SANDBOX_LABEL = util.format('NODE_%s_SANDBOX', label);
  var SANDBOX_VALUE = process.env[SANDBOX_LABEL] || process.env.NODE_DEVEBOT_SANDBOX;
  if (!process.env[SANDBOX_LABEL]) {
    debugx.enabled && debugx(' - %s not found. Use NODE_DEVEBOT_SANDBOX instead', SANDBOX_LABEL);
  }

  debugx.enabled && debugx(" - %s's value: %s", PROFILE_LABEL, PROFILE_VALUE);
  debugx.enabled && debugx(" - %s's value: %s", SANDBOX_LABEL, SANDBOX_VALUE);

  var config = loadConfig(appRootDir, libRootDirs, PROFILE_VALUE, SANDBOX_VALUE);

  Object.defineProperty(this, 'config', {
    get: function() { return config },
    set: function(value) {}
  });
}

var loadConfig = function(appRootDir, libRootDirs, PROFILE_VALUE, SANDBOX_VALUE) {
  libRootDirs = libRootDirs || [];

  var config = {};
  var configDir = path.join(appRootDir, '/config');

  var stagingFiles = chores.filterFiles(configDir, '.*\.js');
  var stagingArray = lodash.map(stagingFiles, function(file) {
    return file.replace('.js', '').split(/[_]/);
  });

  var includedNames = {};
  configNames.forEach(function(configName) {
    includedNames[configName] = [];
  });

  if (lodash.isString(PROFILE_VALUE) && PROFILE_VALUE.length > 0) {
    includedNames['profile'].push(PROFILE_VALUE);
  }

  if (lodash.isString(SANDBOX_VALUE) && SANDBOX_VALUE.length > 0) {
    includedNames['sandbox'] = SANDBOX_VALUE.split(',');
  }

  configNames.forEach(function(configName) {
    config[configName] = {};

    var defaultFile = path.join(configDir, configName + '.js');

    debugx.enabled && debugx(' + load the default config: %s', defaultFile);
    config[configName]['default'] = loader(defaultFile);

    libRootDirs.forEach(function(libRootDir) {
      defaultFile = path.join(libRootDir, '/config', configName + '.js');
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

    if (configName == 'profile') {
      var profileList = lodash.values(config[configName]['staging']);
      if (profileList.length > 0) {
        config[configName]['staging'] = profileList[0];
      } else {
        config[configName]['staging'] = config[configName]['default'];
      }
    }

    if (configName == 'sandbox') {
      if (lodash.isEmpty(config[configName]['staging'])) {
        config[configName]['staging']['default'] = config[configName]['default'];
      }
    }

    debugx.enabled && debugx(' - environment config object: %s', util.inspect(config[configName], {depth: 2}));
  });

  return config;
};

module.exports = Loader;
