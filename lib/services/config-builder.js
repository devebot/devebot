'use strict';

var util = require('util');
var lodash = require('lodash');
var logger = require('../utils/logger.js');

function init(config) {
  config = config || {};

  var helper = {};
  
  helper.derive = function(serverName) {
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
  
  return helper;
}

init.derive = function(config, serverNames) {
  serverNames = serverNames || ['elasticsearch', 'mongodb'];
  config = config || {};
  config.derivedConfig = {};
  
  var actor = init(config);
  serverNames.forEach(function(serverName) {
    lodash.assign(config.derivedConfig, actor.derive(serverName));
  });
  
  return config;
};

module.exports = init;