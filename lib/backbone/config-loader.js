'use strict';

var DEVEBOT_PROFILE = process.env.NODE_DEVEBOT_PROFILE;
var DEVEBOT_SANDBOX = process.env.NODE_DEVEBOT_SANDBOX;

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var debuglog = require('../utils/debug.js')('devebot:configLoader');

var configNames = ['general', 'profile', 'sandbox'];

function init(appRootDir, libRootDirs) {
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
  
  if (lodash.isString(DEVEBOT_PROFILE) && DEVEBOT_PROFILE.length > 0) {
    includedNames['profile'].push(DEVEBOT_PROFILE);
  }

  if (lodash.isString(DEVEBOT_SANDBOX) && DEVEBOT_SANDBOX.length > 0) {
    includedNames['sandbox'] = DEVEBOT_SANDBOX.split(',');
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
