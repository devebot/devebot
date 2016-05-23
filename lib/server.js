'use strict';

var lodash = require('lodash');
var http = require('http');
var WebSocketServer = require('ws').Server;

var Injektor = require('injektor');

var CommandController = require('./controllers/command-controller.js');
var CommandManager = require('./backbone/command-manager.js');
var SandboxManager = require('./backbone/sandbox-manager.js');
var BridgeLoader = require('./backbone/bridge-loader.js');
var PluginLoader = require('./backbone/plugin-loader.js');
var LoggingFactory = require('./backbone/logging-factory.js');
var SystemExecutor = require('./backbone/system-executor.js');

var chores = require('./utils/chores.js');

var debuglog = require('./utils/debug.js')('devebot:server');

function init(params) {
  debuglog(' + initialization start ...');
  
  // init the default parameters
  params = params || {};

  // create injektor instance
  var injektor = new Injektor();

  injektor
    .registerObject('appinfo', params['appinfo'])
    .registerObject('bridgeRefs', params['bridgeRefs'])
    .registerObject('pluginRefs', params['pluginRefs'])
    .registerObject('sandboxList', params['sandbox']['context'])
    .registerObject('profileConfig', params['profile']['context'])
    .registerObject('generalConfig', params['general']['default'])
    .defineService('commandController', CommandController)
    .defineService('commandManager', CommandManager)
    .defineService('sandboxManager', SandboxManager)
    .defineService('bridgeLoader', BridgeLoader)
    .defineService('pluginLoader', PluginLoader)
    .defineService('loggingFactory', LoggingFactory)
    .defineService('systemExecutor', SystemExecutor);

  // lookup commandController object
  var commandController = injektor.lookup('commandController');
  
  // application root url
  var appName = params.appName || 'devebot';
  var appRootUrl = '/' + chores.stringKebabCase(appName);

  // creates a HttpServer instance
  var server = http.createServer();

  server.start = function() {
    var serverHost = lodash.get(params, ['profile', 'context', 'devebot', 'host'], '0.0.0.0');
    var serverPort = lodash.get(params, ['profile', 'context', 'devebot', 'port'], 17779);
    var serverInstance = server.listen(serverPort, serverHost, function () {
      var host = serverInstance.address().address;
      var port = serverInstance.address().port;
      console.log(appName + ' (websocket) is listening at http://%s:%s%s', host, port, appRootUrl);
      commandController.startDaemons();
    });
    return serverInstance;
  };

  var wss = new WebSocketServer({ 
    server: server,
    path: appRootUrl + '/execute'
  });
  
  wss.on('connection', function connection(ws) {
    ws.on('open', function handler() {
      if (debuglog.isEnabled) {
        debuglog(' - Websocket@server is opened');
      }
    });
    
    ws.on('message', function incoming(data) {
      if (debuglog.isEnabled) {
        debuglog(' - Websocket@server is received a message data: <%s>', data);
      }
      commandController.executeCommand(data, ws);
    });
    
    ws.on('close', function handler(code, message) {
      if (debuglog.isEnabled) {
        debuglog(' - Websocket@server is closed, code: <%s>, message: <%s>', code, message);
      }
    });
    
    ws.on('error', function handler(error) {
      if (debuglog.isEnabled) {
        debuglog(' - Websocket@server encounter an error: <%s>', error);
      }
    });
  });
  
  wss.on('error', function connection(error) {
    if (debuglog.isEnabled) {
      debuglog(' - Websocket@server has an error: <%s>', JSON.stringify(error));
    }
  });
  
  debuglog(' - initialization has finished');
  
  return server;
}

module.exports = init;
