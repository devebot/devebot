'use strict';

var lodash = require('lodash');
var fs = require('fs');
var path = require('path');

var fileutil = require('../utils/fileutil.js');
var logger = require('../utils/logger.js');
var loader = require('../utils/loader.js');

var ENV = process.env.NODE_ENV_DEBUG || process.env.NODE_ENV;

function loadConfig(configDir) {
  var config = {};

  configDir = configDir || __dirname;
  
  logger.trace('CONFIG is loading from folder [%s] ...', configDir);

  var files = fileutil.listConfigFiles(path.join(configDir, 'default'));
  logger.trace(' * list of config filenames: %s', JSON.stringify(files));
  
  files.forEach(function(file) {
    var configName = file.replace('.js', '').toUpperCase();
    var defaultFile = path.join(configDir, 'default', file);
    var customFile = path.join(configDir, file);
    logger.trace(' + load the default config: %s', defaultFile);
    logger.trace(' - load the custom config: %s', customFile);
    config[configName] = lodash.defaultsDeep(loader(customFile), require(defaultFile));
    
    if (!lodash.isEmpty(ENV)) {
      var customFileEnv = path.join(configDir, file.replace('.js', '') + '.' + ENV + '.js');
      logger.trace(' - load the environment config: %s', customFileEnv);
      config[configName] = lodash.defaultsDeep(loader(customFileEnv), config[configName]);
    }
  });
  
  logger.trace(' * CONFIG object: %s', JSON.stringify(config, null, 2));
  
  logger.trace('CONFIG load done!');

  return config;
}

module.exports = loadConfig;
