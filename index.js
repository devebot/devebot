'use strict';

var configManager = require('./lib/services/config-manager.js');
var Server = require('./lib/server.js');
var logger = require('./lib/utils/logger.js');

function init(params) {
  params = params || {};

  logger.trace(' * devebot is starting up with parameters: %s', JSON.stringify(params, null, 2));
  
  var appRootPath = params.appRootPath;
  var config = configManager(appRootPath + '/config');

  // Start the server
  var server = Server(config.SERVER);
  var serverInstance = server.listen(17779, function () {
    var host = serverInstance.address().address;
    var port = serverInstance.address().port;
    logger.trace('devebot REST API listening at http://%s:%s', host, port);
  });
}

init.logger = logger;

module.exports = init;