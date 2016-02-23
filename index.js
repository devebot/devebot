'use strict';

var lodash = require('lodash');

var appinfoLoader = require('./lib/backbone/appinfo-loader.js');
var configLoader = require('./lib/backbone/config-loader.js');
var Server = require('./lib/server.js');

var logger = require('logdapter').defaultLogger;

function appLoader(params) {
  params = params || {};

  logger.trace(' * devebot is started with parameters: %s', JSON.stringify(params, null, 2));
  
  var appRootPath = params.appRootPath;
  var libRootPaths = params.libRootPaths || [];
  var topRootPath = __dirname;
  
  var config = configLoader(appRootPath, libRootPaths.concat(topRootPath));
  config.appinfo = appinfoLoader(appRootPath, libRootPaths, topRootPath);
  config.moduleFolders = [].concat(appRootPath, libRootPaths, topRootPath);

  return {
    config: config,
    server: Server(config)
  };
}

function attachLayer(params, layerRootPath) {
  params = params || {};

  params.libRootPaths = params.libRootPaths || [];
  params.libRootPaths.push(layerRootPath);

  return params;
}

appLoader.attachLayer = attachLayer;
appLoader.logger = logger;

module.exports = appLoader;