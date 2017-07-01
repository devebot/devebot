'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var Validator = require('jsonschema').Validator;
var validator = new Validator();

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debug = require('../utils/debug.js');
var debugx = debug('devebot:scriptExecutor');

var Controller = function(params) {
  debugx.enabled && debugx(' + constructor start ...');

  var self = this;

  var commandManager = params.commandManager;
  var sandboxManager = params.sandboxManager;

  self.executeCommand = function(command, socket) {
    var listeners = { ws: socket };
    var cmd = command || {};
    if (lodash.isString(cmd)) {
      cmd = JSON.parse(cmd);
    }

    debugx.enabled && debugx('Command object: %s', JSON.stringify(cmd));

    if (cmd.command == 'definition') {
      socket.send(JSON.stringify({
        state: 'definition',
        value: {
          appinfo: params.appinfo,
          commands: commandManager.getDefinitions()
        }
      }));
      return;
    }

    var promixe = commandManager.execute(cmd, listeners);
    return sendCommandOutput(cmd, socket, promixe);
  };

  var sendCommandOutput = function(command, socket, promise) {
    debugx.enabled && debugx('Command [%s] transfer output ...', command.command);
    promise.then(function(value) {
      socket.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.SUCCESS,
        message: constx.WEBSOCKET.MSG_ON.SUCCESS,
        details: standardizeOutput(value, false)
      }));
    }, function(error) {
      socket.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.FAILURE,
        message: constx.WEBSOCKET.MSG_ON.FAILURE,
        details: standardizeOutput(error, true)
      }));
    }).finally(function() {
      debugx.enabled && debugx('Command [%s] has been done', command.command);
      socket.send(JSON.stringify({ state: constx.WEBSOCKET.STATE.DONE }));
    });
  };

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
};

Controller.argumentSchema = {
  "id": "scriptExecutor",
  "type": "object",
  "properties": {
    "appinfo": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "commandManager": {
      "type": "object"
    },
    "sandboxManager": {
      "type": "object"
    }
  }
};

module.exports = Controller;
