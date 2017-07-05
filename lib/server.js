'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var http = require('http');
var https = require('https');
var fs = require('fs');
var onDeath = require('death');
var WebSocketServer = require('ws').Server;

var Injektor = require('injektor');

var CommandManager = require('./backbone/command-manager.js');
var ContextMonitor = require('./backbone/context-monitor.js');
var SandboxManager = require('./backbone/sandbox-manager.js');
var ScriptExecutor = require('./backbone/script-executor.js');
var ScriptRenderer = require('./backbone/script-renderer.js');
var SecurityManager = require('./backbone/security-manager.js');
var BridgeLoader = require('./backbone/bridge-loader.js');
var PluginLoader = require('./backbone/plugin-loader.js');
var LoggingFactory = require('./backbone/logging-factory.js');

var chores = require('./utils/chores.js');

var debugx = require('./utils/debug.js')('devebot:server');

function init(params) {
  debugx.enabled && debugx(' + initialization start ...');

  // init the default parameters
  params = params || {};

  // create injektor instance
  var injektor = new Injektor();

  injektor
    .registerObject('appinfo', params['appinfo'])
    .registerObject('bridgeRefs', params['bridgeRefs'])
    .registerObject('pluginRefs', params['pluginRefs'])
    .registerObject('sandboxList', params['sandbox']['staging'])
    .registerObject('profileConfig', params['profile']['staging'])
    .defineService('commandManager', CommandManager)
    .defineService('contextMonitor', ContextMonitor)
    .defineService('sandboxManager', SandboxManager)
    .defineService('scriptExecutor', ScriptExecutor)
    .defineService('securityManager', SecurityManager)
    .defineService('bridgeLoader', BridgeLoader)
    .defineService('pluginLoader', PluginLoader)
    .defineService('loggingFactory', LoggingFactory);

  // lookup service instances
  var sandboxManager = injektor.lookup('sandboxManager');
  var scriptExecutor = injektor.lookup('scriptExecutor');
  var securityManager = injektor.lookup('securityManager');

  // application root url
  var appName = params.appName || 'devebot';
  var appRootUrl = '/' + chores.stringKebabCase(appName);

  // devebot configures
  var devebotCfg = lodash.get(params, ['profile', 'staging', 'devebot'], {});

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
    debugx.enabled && debugx('startup() is invoked');
    return new Promise(function(resolved, rejected) {
      var serverHost = lodash.get(devebotCfg, ['host'], '0.0.0.0');
      var serverPort = lodash.get(devebotCfg, ['port'], 17779);
      var serverInstance = server.listen(serverPort, serverHost, function () {
        var host = serverInstance.address().address;
        var port = serverInstance.address().port;
        (devebotCfg && devebotCfg.verbose !== false || debugx.enabled) &&
        console.log(appName + ' is listening at %s://%s:%s%s', sslEnabled?'wss':'ws', host, port, appRootUrl);
        resolved(serverInstance);
      });
    }).then(function() {
      return sandboxManager.startTriggers();
    });
  };

  var serverCloseEvent;
  server.teardown = function() {
    debugx.enabled && debugx('teardown() is invoked');
    return Promise.resolve().then(function() {
      return sandboxManager.stopTriggers();
    }).then(function() {
      return new Promise(function(resolved, rejected) {
        var timeoutHandler = setTimeout(function() {
          debugx.enabled && debugx('Timeout closing Server');
          resolved();
        }, 10000);
        if (typeof(serverCloseEvent) === 'function') {
          server.removeListener("close", serverCloseEvent);
        }
        server.on("close", serverCloseEvent = function() {
          debugx.enabled && debugx('Server is closing ...');
        });
        server.close(function() {
          debugx.enabled && debugx('Server has been closed');
          clearTimeout(timeoutHandler);
          offDeath();
          resolved();
        });
      });
    }).then(function() {
      (devebotCfg && devebotCfg.verbose !== false || debugx.enabled) &&
      console.log(appName + ' has been closed');
      return Promise.resolve();
    });
  }

  var offDeath = onDeath(function(signal, err) {
    debugx.enabled && debugx('onDeath - signal: %s / error: %s', signal, JSON.stringify(err));
    server.teardown().finally(function() {
      debugx.enabled && debugx('Server is terminated by signal: %s', signal);
    });
  });

  server.tryit = function(block) {
    return lodash.isFunction(block) && Promise.resolve(block(injektor));
  }

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
    var outlet = new ScriptRenderer({ ws: ws });

    ws.on('open', function handler() {
      debugx.enabled && debugx(' - Websocket@server is opened');
    });

    ws.on('message', function incoming(command) {
      debugx.enabled && debugx(' - Websocket@server is received a command: <%s>', command);
      scriptExecutor.executeCommand(command, outlet);
    });

    ws.on('close', function handler(code, message) {
      debugx.enabled && debugx(' - Websocket@server is closed, code: <%s>, message: <%s>', code, message);
    });

    ws.on('error', function handler(error) {
      debugx.enabled && debugx(' - Websocket@server encounter an error: <%s>', error);
    });
  });

  wss.on('error', function connection(error) {
    debugx.enabled && debugx(' - Websocket@server has an error: <%s>', JSON.stringify(error));
  });

  debugx.enabled && debugx(' - initialization has finished');

  return server;
}

module.exports = init;
