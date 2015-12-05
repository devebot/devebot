'use strict';

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var chores = require('../utils/chores.js');
var logger = require('../utils/logger.js');
var loader = require('../utils/loader.js');

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
  
  var defaultConfigDir = path.join(__dirname, '../../config');
  var defaultFiles = chores.listFiles(defaultConfigDir);
  
  defaultFiles.forEach(function(file) {
    var configName = file.replace('.js', '');
    var defaultFile = path.join(defaultConfigDir, file);
    var customFile = path.join(configDir, file);
    config[configName] = {};
    config[configName]['default'] = lodash.defaultsDeep(loader(customFile), require(defaultFile));
    
    logger.trace(' + load the default config: %s', defaultFile);
    logger.trace(' - load the custom config: %s', customFile);
    logger.debug(' - Config object (default): %s', JSON.stringify(config));
    
    var includeNames = [];
    if (lodash.isString(process.env.NODE_DEVEBOT_CTX) && process.env.NODE_DEVEBOT_CTX.length > 0) {
      includeNames = process.env.NODE_DEVEBOT_CTX.split(',');
    }

    var contextNames = lodash.filter(contextArray, function(item) {
      var found = (item.length == 3) && 
          (item[0] == configName) &&
          (item[1].length > 0) &&
          (item[2] == 'js');
      
      if (includeNames.length > 0) {
        found = found && (lodash.indexOf(includeNames, item[1]) >= 0);
      }
      
      return found;
    });
    
    config[configName]['context'] ={};
    lodash.forEach(contextNames, function(contextItem) {
      var contextFile = path.join(configDir, contextItem.join('.'));
      logger.trace(' - load the environment config: %s', contextFile);
      var contextCfg = lodash.defaultsDeep(loader(contextFile), config[configName]['default']);
      if (!(contextCfg.disabled)) {
        var contextName = contextItem[1];
        config[configName]['context'][contextName] = contextCfg;
        
        if (configName == 'server') {
          init.deriveConfig(config[configName]['context'][contextName]);
        }
      }
    });
  });
  
  logger.debug(' * Config object (expanded): %s', JSON.stringify(config));
  
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
