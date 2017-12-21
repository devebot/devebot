'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var events = require('events');
var util = require('util');
var http = require('http');
var https = require('https');
var fs = require('fs');
var onDeath = require('death');
var WebSocketServer = require('ws').Server;

var Kernel = require('./kernel.js');
var chores = require('./utils/chores.js');
var debugx = require('./utils/pinbug.js')('devebot:server');
var RepeatedTimer = require('./backbone/repeated-timer');

function Server(params) {
  Kernel.call(this, params);

  debugx.enabled && debugx(' + initialization start ...');

  // init the default parameters
  params = params || {};

  // lookup service instances
  var injektor = this._injektor;
  delete this._injektor;
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
    period: 60 * 1000,
    target: function() {
      debugx.enabled && debugx(' - Since: %s, Uptime: %s', this.startTime.toISOString(), this.uptime);
    }
  });

  var mode = ['silent', 'heartbeat', 'command'].indexOf(devebotCfg.mode);

  this.start = function() {
    debugx.enabled && debugx('startup() is invoked');
    return Promise.resolve().then(function() {
      if (mode == 0) return Promise.resolve();
      if (mode == 1) return rhythm.start();
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
      });
    }).then(function() {
      return sandboxManager.startTriggers();
    });
  };

  var serverCloseEvent;
  this.teardown = function() {
    debugx.enabled && debugx('teardown() is invoked');
    return Promise.resolve().then(function() {
      return sandboxManager.stopTriggers();
    }).then(function() {
      if (mode == 0) return Promise.resolve();
      if (mode == 1) return rhythm.stop();
      return new Promise(function(onResolved, onRejected) {
        var timeoutHandler = setTimeout(function() {
          debugx.enabled && debugx('Timeout closing Server');
          onResolved();
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
          onResolved();
        });
      });
    }).then(function() {
      (devebotCfg && devebotCfg.verbose !== false || debugx.enabled) &&
      console.log(appName + ' has been closed');
      return Promise.resolve();
    });
  }

  var self = this;
  var offDeath = onDeath(function(signal, err) {
    if (err) {
      debugx.enabled && debugx('Signal: %s is raised by error: %s', signal, JSON.stringify(err));
    } else {
      debugx.enabled && debugx('Signal: %s is raised', signal);
    }
    self.teardown().finally(function() {
      debugx.enabled && debugx('Server is terminated by signal: %s', signal);
      offDeath && offDeath();
      offDeath = null;
    });
  });

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
}

util.inherits(Server, Kernel);

module.exports = Server;
