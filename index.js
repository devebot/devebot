'use strict';

var lodash = require('lodash');

var appinfoLoader = require('./lib/services/appinfo-loader.js');
var configLoader = require('./lib/services/config-loader.js');
var Server = require('./lib/server.js');

var logger = require('logdapter').defaultLogger;

function init(params) {
  params = params || {};

  logger.trace(' * devebot is starting up with parameters: %s', JSON.stringify(params));
  
  var appRootPath = params.appRootPath;
  var libRootPaths = params.libRootPaths || [];
  
  var config = configLoader(appRootPath + '/config');
  config.APPINFO = appinfoLoader(appRootPath);
  config.scriptfolders = [].concat(
    [ appRootPath + '/lib/scripts' ],
    lodash.map(libRootPaths, function(libRootPath) {
      return libRootPath + '/lib/scripts';
    }),
    [ __dirname + '/lib/scripts' ]
  );

  return {
    config: config,
    server: Server(config)
  };
}

init.configLoader = configLoader;
init.logger = logger;

module.exports = init;