'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var events = require('events');
var util = require('util');

var Kernel = require('./kernel.js');
var debugx = require('./utils/debug.js')('devebot:runner');

function Runner(params) {
  Kernel.call(this, params);

  debugx.enabled && debugx(' + constructor start ...');

  var injektor = this._injektor;
  delete this._injektor;
  var scriptExecutor = injektor.lookup('scriptExecutor');
  var scriptRenderer = injektor.lookup('scriptRenderer');

  var ws = new WsServerMock();

  var outlet = scriptRenderer.createOutlet({ ws: ws });

  ws.on('message', function(command) {
    debugx.enabled && debugx(' - Runner receives a command: <%s>', command);
    scriptExecutor.executeCommand(command, outlet);
  });

  this.listen = function() {
    return ws.register(new WsClientMock(ws));
  }

  this.invoke = function(block) {
    return lodash.isFunction(block) && Promise.resolve(block(injektor));
  }

  debugx.enabled && debugx(' - constructor has finished');
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