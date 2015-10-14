'use strict';

var lodash = require('lodash');
var util = require('util');
var path = require('path');

var fileutil = require('../utils/fileutil.js');
var logger = require('../utils/logger.js');
var loader = require('../utils/loader.js');

var NODE_ENV = process.env.NODE_DEVEBOT_ENV || process.env.NODE_ENV;

function init(configDir) {
  var config = init.loadConfig(configDir);
  init.deriveConfig(config.SERVER);
  return config;
}

init.loadConfig = function(configDir) {
  var config = {};
  var configDefaultDir = path.join(__dirname, '../../config');

  configDir = configDir || configDefaultDir;
  
  logger.trace(' * CONFIG is loading from folder [%s] ...', configDir);

  var files = fileutil.listConfigFiles(configDefaultDir);
  logger.trace(' * list of config filenames: %s', JSON.stringify(files));
  
  files.forEach(function(file) {
    var configName = file.replace('.js', '').toUpperCase();
    var defaultFile = path.join(configDefaultDir, file);
    var customFile = path.join(configDir, file);
    logger.trace(' + load the default config: %s', defaultFile);
    logger.trace(' - load the custom config: %s', customFile);
    config[configName] = lodash.defaultsDeep(loader(customFile), require(defaultFile));
    
    if (!lodash.isEmpty(NODE_ENV)) {
      var customFileEnv = path.join(configDir, file.replace('.js', '') + '.' + NODE_ENV + '.js');
      logger.trace(' - load the environment config: %s', customFileEnv);
      config[configName] = lodash.defaultsDeep(loader(customFileEnv), config[configName]);
    }
  });
  
  logger.trace(' * CONFIG object: %s', JSON.stringify(config, null, 2));
  
  logger.trace(' * CONFIG load done!');

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
