'use strict';

const assert = require('assert');
const Promise = require('bluebird');
const lodash = require('lodash');
const util = require('util');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const blockRef = chores.getBlockRef(__filename);

function ScriptRenderer(params={}) {
  let self = this;
  let loggingFactory = params.loggingFactory.branch(blockRef);
  let LX = loggingFactory.getLogger();
  let LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let defaultOpts = lodash.assign({
    logger: LX,
    tracer: LT
  }, lodash.pick(params, ['schemaValidator']));

  self.createOutlet = function(opts) {
    return new WebSocketOutlet(lodash.assign({}, defaultOpts, opts));
  }

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

function AbstractOutlet(params) {
  let self = this;

  self._send = function(message) {
    assert.fail('_send() method must be overriden');
  }

  self.render = function(state, output) {
    switch(state) {
      case 'error':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.ERROR,
        message: constx.WEBSOCKET.MSG_ON.ERROR
      }));
      break;

      case 'definition':
      self._send(JSON.stringify({
        state: 'definition',
        payload: output
      }));
      break;

      case 'started':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.STARTED,
        message: constx.WEBSOCKET.MSG_ON.STARTED
      }));
      break;

      case 'progress':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.PROGRESS,
        message: constx.WEBSOCKET.MSG_ON.PROGRESS,
        percent: output.progress,
        payload: output.data,
        progress: output.progress, //deprecated
        data: output.data //deprecated
      }));
      break;

      case 'failed':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.FAILED,
        message: constx.WEBSOCKET.MSG_ON.FAILED,
        payload: standardizeOutput(params.schemaValidator, output, true)
      }));
      break;

      case 'completed':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.COMPLETED,
        message: constx.WEBSOCKET.MSG_ON.COMPLETED,
        payload: standardizeOutput(params.schemaValidator, output, false)
      }));
      break;

      case 'cancelled':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.CANCELLED,
        message: constx.WEBSOCKET.MSG_ON.CANCELLED
      }));
      break;

      case 'done':
      self._send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.DONE
      }));
      break;
    }
  }
}

function WebSocketOutlet(params) {
  AbstractOutlet.apply(this, arguments);

  params = params || {};
  let {logger: LX, tracer: LT, ws} = params;

  assert(lodash.isObject(LX));
  assert(lodash.isObject(LT));
  assert(lodash.isObject(ws));

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    text: ' - create a new WebSocketOutlet()'
  }));

  this._send = function(message) {
    ws.send(message);
  }

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    text: ' - the new WebSocketOutlet() has been created'
  }));
}

util.inherits(WebSocketOutlet, AbstractOutlet);

ScriptRenderer.argumentSchema = {
  "$id": "scriptRenderer",
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

let standardizeOutput = function(schemaValidator, output, isError) {
  let outputArray = lodash.filter(chores.arrayify(output), function(outputObject) {
    return lodash.isObject(outputObject) && !lodash.isEmpty(outputObject);
  });
  let result = schemaValidator.validate(outputArray, constx.WEBSOCKET.DETAILS.SCHEMA);
  if (!result.valid) {
    outputArray = [{
      type: 'json',
      title: isError ? constx.WEBSOCKET.MSG_ON.FAILED : constx.WEBSOCKET.MSG_ON.COMPLETED,
      data: output
    }];
  }
  return outputArray;
};
