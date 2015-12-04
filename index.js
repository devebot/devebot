'use strict';

var appinfoLoader = require('./lib/services/appinfo-loader.js');
var configLoader = require('./lib/services/config-loader.js');
var Server = require('./lib/server.js');
var logger = require('./lib/utils/logger.js');

function init(params) {
  params = params || {};

  logger.trace(' * devebot is starting up with parameters: %s', JSON.stringify(params));
  
  var appRootPath = params.appRootPath;
  
  var config = configLoader(appRootPath + '/config');
  var configDevebot = config.system.default.devebot || {port: 17779};
  
  config.APPINFO = appinfoLoader(appRootPath);

  // Start the server
  var server = Server(config);
  var serverInstance = server.listen(configDevebot.port, function () {
    var host = serverInstance.address().address;
    var port = serverInstance.address().port;
    console.log('devebot service listening at http://%s:%s', host, port);
  });
}

init.configLoader = configLoader;
init.logger = logger;

module.exports = init;