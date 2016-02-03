'use strict';

var appinfoLoader = require('./lib/services/appinfo-loader.js');
var configLoader = require('./lib/services/config-loader.js');
var Server = require('./lib/server.js');

var logger = require('logdapter').defaultLogger;

function init(params) {
  params = params || {};

  logger.trace(' * devebot is starting up with parameters: %s', JSON.stringify(params));
  
  var appRootPath = params.appRootPath;
  
  var config = configLoader(appRootPath + '/config');
  config.APPINFO = appinfoLoader(appRootPath);

  return {
    config: config,
    server: Server(config)
  };
}

init.configLoader = configLoader;
init.logger = logger;

module.exports = init;