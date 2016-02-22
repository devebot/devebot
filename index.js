'use strict';

var lodash = require('lodash');

var appinfoLoader = require('./lib/backbone/appinfo-loader.js');
var configLoader = require('./lib/backbone/config-loader.js');
var Server = require('./lib/server.js');

var logger = require('logdapter').defaultLogger;

function init(params) {
  params = params || {};

  logger.trace(' * devebot is starting up with parameters: %s', JSON.stringify(params));
  
  var appRootPath = params.appRootPath;
  var libRootPaths = params.libRootPaths || [];
  
  var config = configLoader(appRootPath + '/config');
  config.APPINFO = appinfoLoader(appRootPath);
  config.moduleFolders = [].concat(appRootPath, libRootPaths, __dirname);

  return {
    config: config,
    server: Server(config)
  };
}

init.configLoader = configLoader;
init.logger = logger;

module.exports = init;