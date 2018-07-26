'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const events = require('events');
const util = require('util');
const http = require('http');
const https = require('https');
const fs = require('fs');
const WebSocketServer = require('ws').Server;

const Kernel = require('./kernel');
const chores = require('./utils/chores');
const LoggingWrapper = require('./backbone/logging-wrapper');
const RepeatedTimer = require('./backbone/repeated-timer');
const blockRef = chores.getBlockRef(__filename);

function Server(params) {
  Kernel.call(this, params);

  // init the default parameters
  let loggingWrapper = new LoggingWrapper(blockRef);
  let LX = loggingWrapper.getLogger();
  let LT = loggingWrapper.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  // lookup service instances
  let injektor = this._injektor;
  delete this._injektor;

  let profileConfig = injektor.lookup('profileConfig', chores.injektorContext);
  let loggingFactory = injektor.lookup('loggingFactory', chores.injektorContext);
  let sandboxManager = injektor.lookup('sandboxManager', chores.injektorContext);
  let scriptExecutor = injektor.lookup('scriptExecutor', chores.injektorContext);
  let scriptRenderer = injektor.lookup('scriptRenderer', chores.injektorContext);
  let securityManager = injektor.lookup('securityManager', chores.injektorContext);

  // application root url
  let appName = injektor.lookup('appName', chores.injektorContext);
  let appRootUrl = '/' + chores.stringKebabCase(appName);

  // devebot configures
  let devebotCfg = lodash.get(profileConfig, ['devebot'], {});

  let tunnelCfg = lodash.get(devebotCfg, ['tunnel'], {});
  let sslEnabled = tunnelCfg.enabled && tunnelCfg.key_file && tunnelCfg.crt_file;

  let processRequest = function(req, res) {
    if (chores.isDevelopmentMode() || devebotCfg.appInfoLevel === 'all') {
      let appInfo = injektor.lookup('appInfo', chores.injektorContext);
      let appInfoBody = JSON.stringify(appInfo, null, 2);
      res.writeHead(200, 'OK', {
        'Content-Length': Buffer.byteLength(appInfoBody, 'utf8'),
        'Content-Type': 'application/json'
      });
      res.end(appInfoBody);
    } else {
      res.writeHead(200, 'OK');
      res.end();
    }
  };

  // creates a HttpServer instance
  let server = sslEnabled ? https.createServer({
    key: fs.readFileSync(tunnelCfg.key_file),
    cert: fs.readFileSync(tunnelCfg.crt_file)
  }, processRequest) : http.createServer(processRequest);

  let rhythm = new RepeatedTimer({
    loggingFactory: loggingFactory,
    period: 60 * 1000,
    target: function() {
      LX.has('conlog') && LX.log('conlog', ' - Since: %s, Uptime: %s', this.startTime.toISOString(), this.uptime);
    }
  });

  let mode = ['silent', 'tictac', 'server'].indexOf(getDevebotMode(devebotCfg.mode));

  this.start = function() {
    LX.has('silly') && LX.log('silly', LT.toMessage({
      tags: [ blockRef, 'start()' ],
      text: 'start() is invoked'
    }));
    return Promise.resolve().then(function() {
      if (mode == 0) return Promise.resolve();
      if (mode == 1) return rhythm.start();
      return new Promise(function(onResolved, onRejected) {
        let serverHost = lodash.get(devebotCfg, ['host'], '0.0.0.0');
        let serverPort = lodash.get(devebotCfg, ['port'], 17779);
        let serverInstance = server.listen(serverPort, serverHost, function () {
          let proto = sslEnabled ? 'wss' : 'ws';
          let host = serverInstance.address().address;
          let port = serverInstance.address().port;
          chores.isVerboseForced('devebot', devebotCfg) &&
              console.log('%s is listening on %s://%s:%s%s', appName, proto, host, port, appRootUrl);
          onResolved(serverInstance);
        });
      });
    }).then(function() {
      LX.has('silly') && LX.log('silly', LT.toMessage({
        tags: [ blockRef, 'start()', 'webserver-started' ],
        text: 'webserver has started'
      }));
      return sandboxManager.startTriggers();
    }).then(function(info) {
      LX.has('silly') && LX.log('silly', LT.toMessage({
        tags: [ blockRef, 'start()', 'triggers-started' ],
        text: 'triggers have started'
      }));
      return info;
    });
  };

  this.open = this.start; // alias

  let serverCloseEvent;
  this.stop = function() {
    LX.has('silly') && LX.log('silly', LT.toMessage({
      tags: [ blockRef, 'close()' ],
      text: 'close() is invoked'
    }));
    return Promise.resolve().then(function() {
      return sandboxManager.stopTriggers();
    }).then(function() {
      LX.has('silly') && LX.log('silly', LT.toMessage({
        tags: [ blockRef, 'close()', 'triggers-stopped' ],
        text: 'triggers have stopped'
      }));
      if (mode == 0) return Promise.resolve();
      if (mode == 1) return rhythm.stop();
      return new Promise(function(onResolved, onRejected) {
        let timeoutHandler = setTimeout(function() {
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
      LX.has('silly') && LX.log('silly', LT.toMessage({
        tags: [ blockRef, 'close()', 'webserver-stopped' ],
        text: 'webserver has stopped'
      }));
      chores.isVerboseForced('devebot', devebotCfg) &&
          console.log('%s has been closed', appName);
      return Promise.resolve();
    });
  }

  this.close = this.stop; // alias

  let wss = new WebSocketServer({
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
    let outlet = scriptRenderer.createOutlet({ ws: ws });

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

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

util.inherits(Server, Kernel);

module.exports = Server;

const MODE_MAP = {
  "command": "server",
  "heartbeat": "tictac"
}

function getDevebotMode(mode) {
  return MODE_MAP[mode] || mode;
}
