'use strict';

const assert = require('assert');
const lodash = require('lodash');
const util = require('util');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const nodash = require('../utils/nodash');
const blockRef = chores.getBlockRef(__filename);

function ScriptRenderer(params = {}) {
  const loggingFactory = params.loggingFactory.branch(blockRef);
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  const defaultOpts = lodash.assign({
    logger: L,
    tracer: T
  }, lodash.pick(params, ['schemaValidator']));

  this.createOutlet = function(opts) {
    return new WebSocketOutlet(lodash.assign({}, defaultOpts, opts));
  }

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

function AbstractOutlet(params) {
  this._send = function(message) {
    assert.fail('_send() method must be overriden');
  }

  this.render = function(state, output) {
    const self = this;
    switch (state) {
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
  const {logger: L, tracer: T, ws} = params;

  assert(lodash.isObject(L));
  assert(lodash.isObject(T));
  assert(lodash.isObject(ws));

  L.has('dunce') && L.log('dunce', T.toMessage({
    text: ' - create a new WebSocketOutlet()'
  }));

  this._send = function(message) {
    ws.send(message);
  }

  L.has('dunce') && L.log('dunce', T.toMessage({
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

function standardizeOutput(schemaValidator, output, isError) {
  const outputArray = lodash.filter(nodash.arrayify(output), function(outputObject) {
    return lodash.isObject(outputObject) && !lodash.isEmpty(outputObject);
  });
  const result = schemaValidator.validate(outputArray, constx.WEBSOCKET.DETAILS.SCHEMA);
  if (!result.valid) {
    return [{
      type: 'json',
      title: isError ? constx.WEBSOCKET.MSG_ON.FAILED : constx.WEBSOCKET.MSG_ON.COMPLETED,
      data: output
    }];
  }
  return outputArray;
};
