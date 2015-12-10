'use strict';

var DEVEBOT_PROFILE = process.env.NODE_DEVEBOT_PROFILE;
var DEVEBOT_SANDBOX = process.env.NODE_DEVEBOT_SANDBOX;

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var logger = require('logdapter').defaultLogger;

function init(configDir) {
  var config = init.loadContext(configDir);
  return config;
}

init.loadContext = function(configDir) {
  var config = {};
  
  var contextFiles = chores.listFiles(configDir);
  var contextArray = lodash.map(contextFiles, function(file) {
    return file.split('.');
  });
  
  var includedNames = {};
  ['general', 'profile', 'sandbox'].forEach(function(configName) {
    includedNames[configName] = [];
  });
  
  if (lodash.isString(DEVEBOT_PROFILE) && DEVEBOT_PROFILE.length > 0) {
    includedNames['profile'].push(DEVEBOT_PROFILE);
  }

  if (lodash.isString(DEVEBOT_SANDBOX) && DEVEBOT_SANDBOX.length > 0) {
    includedNames['sandbox'] = DEVEBOT_SANDBOX.split(',');
  }
  
  var defaultConfigDir = path.join(__dirname, '../../config');
  var defaultFiles = chores.listFiles(defaultConfigDir);
  
  defaultFiles.forEach(function(file) {
    var configName = file.replace('.js', '');
    var defaultFile = path.join(defaultConfigDir, file);
    var customFile = path.join(configDir, file);
    config[configName] = {};
    
    logger.trace(' + load the default config: %s', defaultFile);
    config[configName]['default'] = lodash.defaultsDeep(loader(customFile), require(defaultFile));
    logger.debug(' - Config object (default): %s', JSON.stringify(config[configName]));
    
    logger.trace(' - load the custom config: %s', customFile);
    config[configName]['context'] ={};

    var contextNames = lodash.filter(contextArray, function(item) {
      var found = (item.length == 3) && 
          (item[0] == configName) &&
          (item[1].length > 0) &&
          (item[2] == 'js');
      
      if (includedNames[configName].length > 0) {
        found = found && (lodash.indexOf(includedNames[configName], item[1]) >= 0);
      }
      
      return found;
    });
    
    lodash.forEach(contextNames, function(contextItem) {
      var contextFile = path.join(configDir, contextItem.join('.'));
      logger.trace(' - load the environment config: %s', contextFile);
      var contextCfg = lodash.defaultsDeep(loader(contextFile), config[configName]['default']);
      if ((includedNames[configName].length > 0) || !(contextCfg.disabled)) {
        var contextName = contextItem[1];
        config[configName]['context'][contextName] = contextCfg;
        
        if (configName == 'sandbox') {
          init.deriveConfig(config[configName]['context'][contextName]);
        }
      }
    });
    
    if (configName == 'profile') {
      var profileList = lodash.values(config[configName]['context']);
      if (profileList.length > 0) {
        config[configName]['default'] = profileList[0];
      }
    }
    
    logger.debug(' - Config object (context): %s', JSON.stringify(config[configName]));
  });

  return config;
};

init.deriveConfig = function(config, serverNames) {
  serverNames = serverNames || ['elasticsearch', 'mongodb'];

  config = config || {};
  
  var derive = function(config, serverName) {
    var derivedConfig = {};
    switch(serverName) {
      case 'elasticsearch': 
        var es_conf = config['elasticsearch'] || {};
        derivedConfig.es_url = util.format('%s://%s:%s/', es_conf.protocol || 'http', es_conf.host, es_conf.port);
        derivedConfig.es_index_url = derivedConfig.es_url + es_conf.name + '/';
        break;
      case 'mongodb': {
        var mongo_conf = config['mongodb'] || {};
        derivedConfig.mongo_connection_string = util.format('mongodb://%s:%s/%s', 
            mongo_conf.host, mongo_conf.port, mongo_conf.name);
        derivedConfig.mongo_collection_names = mongo_conf.cols;
        break;
      }
    }
    return derivedConfig;
  };

  config.derivedConfig = {};
  
  serverNames.forEach(function(serverName) {
    lodash.assign(config.derivedConfig, derive(config, serverName));
  });
  
  return config;
};

module.exports = init;
