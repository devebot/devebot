'use strict';

const events = require('events');
const util = require('util');

const Kernel = require('./kernel');
const chores = require('./utils/chores');
const LoggingWrapper = require('./backbone/logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

function Runner(params = {}) {
  Kernel.call(this, params);

  const loggingWrapper = new LoggingWrapper(blockRef);
  const L = loggingWrapper.getLogger();
  const T = loggingWrapper.getTracer();

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  const injektor = this._injektor;
  delete this._injektor;

  const scriptExecutor = injektor.lookup('scriptExecutor', chores.injektorContext);
  const scriptRenderer = injektor.lookup('scriptRenderer', chores.injektorContext);

  this.listen = function() {
    const ws = new WsServerMock();

    const outlet = scriptRenderer.createOutlet({ ws: ws });

    ws.on('message', function(command) {
      L.has('silly') && L.log('silly', T.add({ command }).toMessage({
        tags: [ blockRef, 'receive-a-command' ],
        text: ' - Runner receives a command: %{command}'
      }));
      scriptExecutor.executeCommand(command, outlet);
    });

    return ws.register(new WsClientMock(ws));
  }

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

util.inherits(Runner, Kernel);

module.exports = Runner;

// -----------------------------------------------------------------------------

function WsClientMock(wsServer) {
  events.EventEmitter.call(this);
  this._wsServer = wsServer;
}

util.inherits(WsClientMock, events.EventEmitter);

WsClientMock.prototype.send = function(msg) {
  if (this._wsServer instanceof events.EventEmitter) {
    this._wsServer.emit('message', msg);
  }
};

WsClientMock.prototype.close = function(code, reason) {
  if (this._wsServer instanceof events.EventEmitter) {
    this._wsServer.closeConnection(code, reason);
  }
};

WsClientMock.prototype.ready = function(msg) {
  this.emit('open');
};

// -----------------------------------------------------------------------------

function WsServerMock() {
  events.EventEmitter.call(this);
}

util.inherits(WsServerMock, events.EventEmitter);

WsServerMock.prototype.send = function(msg) {
  if (this._wsClient instanceof events.EventEmitter) {
    this._wsClient.emit('message', msg);
  }
};

WsServerMock.prototype.register = function(wsClient) {
  return (this._wsClient = wsClient);
}

WsServerMock.prototype.closeConnection = function(code, reason) {
  code = code || 0;
  this.emit('close', code, reason);
  if (this._wsClient instanceof events.EventEmitter) {
    this._wsClient.emit('close');
  }
};
