'use strict';

var lodash = require('lodash');
var http = require('http');
var https = require('https');
var fs = require('fs');
var WebSocketServer = require('ws').Server;

var Injektor = require('injektor');

var CommandController = require('./controllers/command-controller.js');
var CommandManager = require('./backbone/command-manager.js');
var SandboxManager = require('./backbone/sandbox-manager.js');
var SecurityManager = require('./backbone/security-manager.js');
var BridgeLoader = require('./backbone/bridge-loader.js');
var PluginLoader = require('./backbone/plugin-loader.js');
var LoggingFactory = require('./backbone/logging-factory.js');

var chores = require('./utils/chores.js');

var debuglog = require('./utils/debug.js')('devebot:server');

function init(params) {
  debuglog.isEnabled && debuglog(' + initialization start ...');

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
    .defineService('securityManager', SecurityManager)
    .defineService('bridgeLoader', BridgeLoader)
    .defineService('pluginLoader', PluginLoader)
    .defineService('loggingFactory', LoggingFactory);

  // lookup service instances
  var commandController = injektor.lookup('commandController');
  var securityManager = injektor.lookup('securityManager');

  // application root url
  var appName = params.appName || 'devebot';
  var appRootUrl = '/' + chores.stringKebabCase(appName);

  // devebot configures
  var devebotCfg = lodash.get(params, ['profile', 'context', 'devebot'], {});

  var tunnelCfg = lodash.get(devebotCfg, ['tunnel'], {});
  var sslEnabled = tunnelCfg.enabled && tunnelCfg.key_file && tunnelCfg.crt_file;

  var processRequest = function(req, res) {
    res.writeHead(200);
    res.end("Devebot WebSockets!\n");
  };

  // creates a HttpServer instance
  var server = sslEnabled ? https.createServer({
    key: fs.readFileSync(tunnelCfg.key_file),
    cert: fs.readFileSync(tunnelCfg.crt_file)
  }, processRequest) : http.createServer(processRequest);

  server.start = function() {
    var serverHost = lodash.get(devebotCfg, ['host'], '0.0.0.0');
    var serverPort = lodash.get(devebotCfg, ['port'], 17779);
    var serverInstance = server.listen(serverPort, serverHost, function () {
      var host = serverInstance.address().address;
      var port = serverInstance.address().port;
      console.log(appName + ' is listening at %s://%s:%s%s', sslEnabled?'wss':'ws', host, port, appRootUrl);
      commandController.startDaemons();
    });
    return serverInstance;
  };

  var wss = new WebSocketServer({
    server: server,
    path: appRootUrl + '/execute',
    verifyClient: function(info, callback) {
      securityManager.authenticate(lodash.pick(info.req.headers, [
        'x-token-jwt', 'x-token-key', 'x-token-secret'
      ])).then(function(output) {
        callback(output.result, output.code, output.name);
      });
    }
  });

  wss.on('connection', function connection(ws) {
    ws.on('open', function handler() {
      debuglog.isEnabled && debuglog(' - Websocket@server is opened');
    });

    ws.on('message', function incoming(data) {
      debuglog.isEnabled && debuglog(' - Websocket@server is received a message data: <%s>', data);
      commandController.executeCommand(data, ws);
    });

    ws.on('close', function handler(code, message) {
      debuglog.isEnabled && debuglog(' - Websocket@server is closed, code: <%s>, message: <%s>', code, message);
    });

    ws.on('error', function handler(error) {
      debuglog.isEnabled && debuglog(' - Websocket@server encounter an error: <%s>', error);
    });
  });

  wss.on('error', function connection(error) {
    debuglog.isEnabled && debuglog(' - Websocket@server has an error: <%s>', JSON.stringify(error));
  });

  debuglog.isEnabled && debuglog(' - initialization has finished');

  return server;
}

module.exports = init;
