'use strict';

var lodash = require('lodash');
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
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

  // Create our Express application
  var app = express();
  
  app.use(session({ 
    secret: '5upersecr3tk3yf0rd3v3b0t',
    saveUninitialized: true,
    resave: true
  }));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  if (debuglog.isEnabled) {
    app.use('*', function(req, res, next) {
      process.nextTick(function() {
        debuglog(' @ devebot service receives a new request:');
        debuglog(' - Request protocol: ' + req.protocol);
        debuglog(' - Request host: ' + req.hostname);
        debuglog(' - Request body: ' + JSON.stringify(req.body));
        debuglog(' - Request user-agent: ' + req.headers['user-agent']);
      });
      next();
    });
  }
  
  // Create our Express router
  var router = express.Router();
  router.route(appRootUrl + '').get(commandController.getAppinfo);
  router.route(appRootUrl + '/clidef').get(commandController.getDefinition);
  router.route(appRootUrl + '/runner').post(commandController.postCommand);
  app.use(router);
  
  // wrapping Express Application by a HttpServer
  var server = http.createServer(app);

  server.start = function() {
    var serverHost = lodash.get(params, ['profile', 'context', 'devebot', 'host'], '0.0.0.0');
    var serverPort = lodash.get(params, ['profile', 'context', 'devebot', 'port'], 17779);
    var serverInstance = server.listen(serverPort, serverHost, function () {
      var host = serverInstance.address().address;
      var port = serverInstance.address().port;
      console.log(appName + ' is listening at http://%s:%s%s', host, port, appRootUrl);
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
