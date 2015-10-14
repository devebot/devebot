'use strict';

var configLoader = require('./lib/services/config-loader.js');
var Server = require('./lib/server.js');
var logger = require('./lib/utils/logger.js');

function init(params) {
  params = params || {};

  logger.trace(' * devebot is starting up with parameters: %s', JSON.stringify(params));
  
  var appRootPath = params.appRootPath;
  var config = configLoader(appRootPath + '/config');
  var configDevebot = config.SYSTEM.devebot || {port: 17779};
  
  config.appRootPath = params.appRootPath;

  // Start the server
  var server = Server(config);
  var serverInstance = server.listen(configDevebot.port, function () {
    var host = serverInstance.address().address;
    var port = serverInstance.address().port;
    logger.trace('devebot REST API listening at http://%s:%s', host, port);
  });
}

init.configLoader = configLoader;
init.logger = logger;

module.exports = init;