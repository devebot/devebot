'use strict';

var assert = require('assert');
var Promise = require('bluebird');
var lodash = require('lodash');
var util = require('util');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

function ScriptRenderer(params) {
  var self = this;
  params = params || {};

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  var defaultOpts = lodash.assign({
    logger: LX,
    tracer: LT
  }, lodash.pick(params, ['schemaValidator']));

  self.createOutlet = function(opts) {
    return new WebSocketOutlet(lodash.assign({}, defaultOpts, opts));
  }

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
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

  params.logger.has('conlog') && params.logger.log('conlog', params.tracer.stringify({
    text: ' - create a new WebSocketOutlet()'
  }));

  self._send = function(message) {
    params.ws.send(message);
  }

  params.logger.has('conlog') && params.logger.log('conlog', params.tracer.stringify({
    text: ' - the new WebSocketOutlet() has been created'
  }));
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
