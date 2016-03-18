'use strict';

var PROFILE_VALUE = process.env.NODE_DEVEBOT_PROFILE;
var SANDBOX_VALUE = process.env.NODE_DEVEBOT_SANDBOX;

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var debuglog = require('../utils/debug.js')('devebot:configLoader');

var configNames = ['general', 'profile', 'sandbox'];

function init(appName, appRootDir, libRootDirs) {
  var label = chores.stringLabelCase(appName);
  if (debuglog.isEnabled) {
    debuglog(' + Config of application (%s) is loaded in context: %s', appName, label);
  }
  
  var PROFILE_LABEL = util.format('NODE_%s_PROFILE', label);
  PROFILE_VALUE = process.env[PROFILE_LABEL] || PROFILE_VALUE;
  if (debuglog.isEnabled && !process.env[PROFILE_LABEL]) {
    debuglog(' - %s not found. Use NODE_DEVEBOT_PROFILE instead', PROFILE_LABEL);
  }
  
  var SANDBOX_LABEL = util.format('NODE_%s_SANDBOX', label);
  SANDBOX_VALUE = process.env[SANDBOX_LABEL] || SANDBOX_VALUE;
  if (debuglog.isEnabled && !process.env[SANDBOX_LABEL]) {
    debuglog(' - %s not found. Use NODE_DEVEBOT_SANDBOX instead', SANDBOX_LABEL);
  }
  
  if (debuglog.isEnabled) {
    debuglog(" - %s's value: %s", PROFILE_LABEL, PROFILE_VALUE);
    debuglog(" - %s's value: %s", SANDBOX_LABEL, SANDBOX_VALUE);
  }
  
  var config = init.loadConfig(appRootDir, libRootDirs);
  return config;
}

init.loadConfig = function(appRootDir, libRootDirs) {
  libRootDirs = libRootDirs || [];

  var config = {};
  var configDir = path.join(appRootDir, '/config');

  var contextFiles = chores.filterFiles(configDir, '.*\.js');
  var contextArray = lodash.map(contextFiles, function(file) {
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
    
    if (debuglog.isEnabled) debuglog(' + load the default config: %s', defaultFile);
    config[configName]['default'] = loader(defaultFile);
    
    libRootDirs.forEach(function(libRootDir) {
      defaultFile = path.join(libRootDir, '/config', configName + '.js');  
      config[configName]['default'] = lodash.defaultsDeep(loader(defaultFile), 
        config[configName]['default']);
    });

    if (debuglog.isEnabled) debuglog(' + load the custom config of %s', configName);
    config[configName]['context'] ={};

    var contextNames = lodash.filter(contextArray, function(item) {
      var found = (item.length == 2) && (item[0] == configName) && (item[1].length > 0);
      
      if (includedNames[configName].length > 0) {
        found = found && (lodash.indexOf(includedNames[configName], item[1]) >= 0);
      }
      
      return found;
    });
    
    lodash.forEach(contextNames, function(contextItem) {
      var contextFile = path.join(configDir, contextItem.join('_') + '.js');
      if (debuglog.isEnabled) debuglog(' - load the environment config: %s', contextFile);
      var contextCfg = lodash.defaultsDeep(loader(contextFile), config[configName]['default']);
      if ((includedNames[configName].length > 0) || !(contextCfg.disabled)) {
        var contextName = contextItem[1];
        config[configName]['context'][contextName] = contextCfg;
      }
    });
    
    if (configName == 'profile') {
      var profileList = lodash.values(config[configName]['context']);
      if (profileList.length > 0) {
        config[configName]['default'] = profileList[0];
      }
    }
    
    if (debuglog.isEnabled) {
      debuglog(' - environment config object: %s', util.inspect(config[configName], {depth: 2}));
    }
  });

  return config;
};

module.exports = init;
