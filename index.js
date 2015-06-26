'use strict';

var configManager = require('./lib/services/config-manager.js');
var logger = require('./lib/utils/logger.js');

function load(params) {
  params = params || {};

  logger.trace(' * devebot is starting up with parameters: %s', JSON.stringify(params, null, 2));
  
  var appRootPath = params.appRootPath;
  var config = configManager(appRootPath + '/config');
}

module.exports = load;