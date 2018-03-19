'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var events = require('events');
var util = require('util');

var Kernel = require('./kernel.js');
var chores = require('./utils/chores.js');
var LoggingWrapper = require('./backbone/logging-wrapper.js');

function Runner(params) {
  Kernel.call(this, params);

  var blockRef = chores.getBlockRef(__filename);
  var loggingWrapper = new LoggingWrapper(blockRef);
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  var injektor = this._injektor;
  delete this._injektor;
  var scriptExecutor = injektor.lookup('scriptExecutor', chores.injektorContext);
  var scriptRenderer = injektor.lookup('scriptRenderer', chores.injektorContext);

  var ws = new WsServerMock();

  var outlet = scriptRenderer.createOutlet({ ws: ws });

  ws.on('message', function(command) {
    LX.has('silly') && LX.log('silly', LT.add({
      command: command
    }).toMessage({
      tags: [ blockRef, 'receive-a-command' ],
      text: ' - Runner receives a command: %{command}'
    }));
    scriptExecutor.executeCommand(command, outlet);
  });

  this.listen = function() {
    return ws.register(new WsClientMock(ws));
  }

  this.invoke = function(block) {
    return lodash.isFunction(block) && Promise.resolve(block(injektor));
  }

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

util.inherits(Runner, Kernel);

module.exports = Runner;

//-----------------------------------------------------------------------------

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

//-----------------------------------------------------------------------------

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
