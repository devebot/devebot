'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var events = require('events');
var util = require('util');
var http = require('http');
var https = require('https');
var fs = require('fs');
var WebSocketServer = require('ws').Server;

var Kernel = require('./kernel.js');
var chores = require('./utils/chores.js');
var LoggingWrapper = require('./backbone/logging-wrapper.js');
var RepeatedTimer = require('./backbone/repeated-timer.js');

function Server(params) {
  Kernel.call(this, params);

  // init the default parameters
  params = params || {};

  var loggingWrapper = new LoggingWrapper(chores.getBlockRef(__filename));
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  // lookup service instances
  var injektor = this._injektor;
  delete this._injektor;
  var loggingFactory = injektor.lookup('loggingFactory', chores.injektorContext);
  var sandboxManager = injektor.lookup('sandboxManager', chores.injektorContext);
  var scriptExecutor = injektor.lookup('scriptExecutor', chores.injektorContext);
  var scriptRenderer = injektor.lookup('scriptRenderer', chores.injektorContext);
  var securityManager = injektor.lookup('securityManager', chores.injektorContext);

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

  var rhythm = new RepeatedTimer({
    loggingFactory: loggingFactory,
    period: 60 * 1000,
    target: function() {
      LX.has('conlog') && LX.log('conlog', ' - Since: %s, Uptime: %s', this.startTime.toISOString(), this.uptime);
    }
  });

  var mode = ['silent', 'heartbeat', 'command'].indexOf(devebotCfg.mode);

  this.start = function() {
    LX.has('conlog') && LX.log('conlog', LT.toMessage({
      tags: [ 'devebot-server-start', 'starting' ],
      text: 'start() is invoked'
    }));
    return Promise.resolve().then(function() {
      if (mode == 0) return Promise.resolve();
      if (mode == 1) return rhythm.start();
      return new Promise(function(onResolved, onRejected) {
        var serverHost = lodash.get(devebotCfg, ['host'], '0.0.0.0');
        var serverPort = lodash.get(devebotCfg, ['port'], 17779);
        var serverInstance = server.listen(serverPort, serverHost, function () {
          var host = serverInstance.address().address;
          var port = serverInstance.address().port;
          chores.isVerboseForced('devebot', devebotCfg) &&
              console.log(appName + ' is listening at %s://%s:%s%s', 
                  sslEnabled?'wss':'ws', host, port, appRootUrl);
          onResolved(serverInstance);
        });
      });
    }).then(function() {
      LX.has('conlog') && LX.log('conlog', LT.toMessage({
        tags: [ 'devebot-server-start', 'webserver-started' ],
        text: 'webserver has started'
      }));
      return sandboxManager.startTriggers();
    }).then(function(info) {
      LX.has('conlog') && LX.log('conlog', LT.toMessage({
        tags: [ 'devebot-server-start', 'triggers-started' ],
        text: 'triggers have started'
      }));
      return info;
    });
  };

  var serverCloseEvent;
  this.teardown = function() {
    LX.has('conlog') && LX.log('conlog', LT.toMessage({
      tags: [ 'devebot-server-close', 'closing' ],
      text: 'close() is invoked'
    }));
    return Promise.resolve().then(function() {
      return sandboxManager.stopTriggers();
    }).then(function() {
      LX.has('conlog') && LX.log('conlog', LT.toMessage({
        tags: [ 'devebot-server-close', 'triggers-stopped' ],
        text: 'triggers have stopped'
      }));
      if (mode == 0) return Promise.resolve();
      if (mode == 1) return rhythm.stop();
      return new Promise(function(onResolved, onRejected) {
        var timeoutHandler = setTimeout(function() {
          LX.has('conlog') && LX.log('conlog', 'Timeout closing Server');
          onRejected();
        }, 60000);
        if (typeof(serverCloseEvent) === 'function') {
          server.removeListener("close", serverCloseEvent);
        }
        server.on("close", serverCloseEvent = function() {
          LX.has('conlog') && LX.log('conlog', 'HTTP Server is invoked');
        });
        server.close(function() {
          LX.has('conlog') && LX.log('conlog', 'HTTP Server has been closed');
          clearTimeout(timeoutHandler);
          onResolved();
        });
      });
    }).then(function() {
      LX.has('conlog') && LX.log('conlog', LT.toMessage({
        tags: [ 'devebot-server-close', 'webserver-stopped' ],
        text: 'webserver has stopped'
      }));
      chores.isVerboseForced('devebot', devebotCfg) &&
          console.log(appName + ' has been closed');
      return Promise.resolve();
    });
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
    var outlet = scriptRenderer.createOutlet({ ws: ws });

    ws.on('open', function handler() {
      LX.has('conlog') && LX.log('conlog', ' - Websocket@server is opened');
    });

    ws.on('message', function incoming(command) {
      LX.has('conlog') && LX.log('conlog', ' - Websocket@server is received a command: <%s>', command);
      scriptExecutor.executeCommand(command, outlet);
    });

    ws.on('close', function handler(code, message) {
      LX.has('conlog') && LX.log('conlog', ' - Websocket@server is closed, code: <%s>, message: <%s>', code, message);
    });

    ws.on('error', function handler(error) {
      LX.has('conlog') && LX.log('conlog', ' - Websocket@server encounter an error: <%s>', error);
    });
  });

  wss.on('error', function connection(error) {
    LX.has('conlog') && LX.log('conlog', ' - Websocket@server has an error: <%s>', JSON.stringify(error));
  });

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

util.inherits(Server, Kernel);

module.exports = Server;
