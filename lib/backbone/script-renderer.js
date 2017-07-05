'use strict';

var assert = require('assert');
var Promise = require('bluebird');
var lodash = require('lodash');
var constx = require('../utils/constx.js');
var debugx = require('../utils/debug.js')('devebot:scriptRenderer');

var Validator = require('jsonschema').Validator;
var validator = new Validator();

function ScriptRenderer(params) {
  var self = this;
  params = params && lodash.clone(params) || {};

  assert(lodash.isObject(params.ws));

  debugx.enabled && debugx(' + constructor start ...');

  self.render = function(state, payload) {
    switch(state) {
      case 'definition':
      params.ws.send(JSON.stringify({
        state: 'definition',
        value: payload.value
      }));
      break;

      case 'enqueue':
      params.ws.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.STARTED,
        message: constx.WEBSOCKET.MSG_ON.STARTED
      }));
      break;

      case 'promotion':
      params.ws.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.PROMOTION,
        message: constx.WEBSOCKET.MSG_ON.PROMOTION
      }));
      break;

      case 'progress':
      params.ws.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.PROGRESS,
        message: constx.WEBSOCKET.MSG_ON.PROGRESS,
        progress: payload.progress,
        data: payload.data
      }));
      break;

      case 'failed':
      case 'attempt':
      params.ws.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.FAILURE,
        message: constx.WEBSOCKET.MSG_ON.FAILURE,
        details: standardizeOutput(payload.error, true)
      }));
      break;

      case 'complete':
      params.ws.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.SUCCESS,
        message: constx.WEBSOCKET.MSG_ON.SUCCESS,
        details: standardizeOutput(payload.result, false)
      }));
      break;

      case 'remove':
      params.ws.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.REMOVE,
        message: constx.WEBSOCKET.MSG_ON.REMOVE
      }));
      break;

      case 'done':
      params.ws.send(JSON.stringify({
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
    var valresult = validator.validate(outputArray, constx.WEBSOCKET.DETAILS.SCHEMA);
    if (valresult.errors.length > 0) {
      outputArray = [{
        type: 'json',
        title: isError ? constx.WEBSOCKET.MSG_ON.FAILURE : constx.WEBSOCKET.MSG_ON.SUCCESS,
        data: output
      }];
    }
    return outputArray;
  };

  debugx.enabled && debugx(' - constructor has finished');
}

module.exports = ScriptRenderer;
