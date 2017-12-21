'use strict';

var assert = require('assert');
var Promise = require('bluebird');
var lodash = require('lodash');
var util = require('util');
var constx = require('../utils/constx.js');
var debugx = require('../utils/pinbug.js')('devebot:scriptRenderer');

function ScriptRenderer(params) {
  var self = this;
  params = params || {};

  debugx.enabled && debugx(' + constructor start ...');

  self.createOutlet = function(opts) {
    return new WebSocketOutlet(lodash.assign(lodash.pick(params, ['schemaValidator']), opts));
  }

  debugx.enabled && debugx(' - constructor has finished');
}

var AbstractOutlet = function(params) {
  var self = this;

  self._send = function(message) {
    assert.fail('_send() method must be overriden');
  }

  self.render = function(state, payload) {
    switch(state) {
      case 'definition':
      self._send(JSON.stringify({
        state: 'definition',
        value: payload.value
      }));
      break;

      case 'enqueue':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.STARTED,
        message: constx.WEBSOCKET.MSG_ON.STARTED
      }));
      break;

      case 'promotion':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.PROMOTION,
        message: constx.WEBSOCKET.MSG_ON.PROMOTION
      }));
      break;

      case 'progress':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.PROGRESS,
        message: constx.WEBSOCKET.MSG_ON.PROGRESS,
        progress: payload.progress,
        data: payload.data
      }));
      break;

      case 'failed':
      case 'attempt':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.FAILURE,
        message: constx.WEBSOCKET.MSG_ON.FAILURE,
        details: standardizeOutput(payload.error, true)
      }));
      break;

      case 'complete':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.SUCCESS,
        message: constx.WEBSOCKET.MSG_ON.SUCCESS,
        details: standardizeOutput(payload.result, false)
      }));
      break;

      case 'remove':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.REMOVE,
        message: constx.WEBSOCKET.MSG_ON.REMOVE
      }));
      break;

      case 'done':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.DONE
      }));
      break;
    }
  }

  var standardizeOutput = function(output, isError) {
    var outputArray = lodash.isArray(output) ? output : [output];
    outputArray = lodash.filter(outputArray, function(outputObject) {
      return lodash.isObject(outputObject) && !lodash.isEmpty(outputObject);
    });
    var result = params.schemaValidator.validate(outputArray, constx.WEBSOCKET.DETAILS.SCHEMA);
    if (result.errors.length > 0) {
      outputArray = [{
        type: 'json',
        title: isError ? constx.WEBSOCKET.MSG_ON.FAILURE : constx.WEBSOCKET.MSG_ON.SUCCESS,
        data: output
      }];
    }
    return outputArray;
  };
}

var WebSocketOutlet = function(params) {
  AbstractOutlet.apply(this, arguments);

  var self = this;
  params = params && lodash.clone(params) || {};
  assert(lodash.isObject(params.ws));

  debugx.enabled && debugx(' - invoke new WebSocketOutlet()');

  self._send = function(message) {
    params.ws.send(message);
  }

  debugx.enabled && debugx(' - new WebSocketOutlet() has finished');
}

util.inherits(WebSocketOutlet, AbstractOutlet);

ScriptRenderer.argumentSchema = {
  "id": "scriptRenderer",
  "type": "object",
  "properties": {
    "loggingFactory": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    }
  }
};

module.exports = ScriptRenderer;
