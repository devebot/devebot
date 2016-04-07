'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');
var lodash = require('lodash');

var Validator = require('jsonschema').Validator;
var validator = new Validator();

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debug = require('../utils/debug.js');
var debuglog = debug('devebot:commandController');

var Controller = function(params) {
  debuglog(' + constructor start ...');
  Controller.super_.apply(this);
  
  var self = this;
  
  var commandManager = params.commandManager;
  var sandboxManager = params.sandboxManager;

  self.startDaemons = function() {
    sandboxManager.startTriggers();
  };
  
  self.stopDaemons = function() {
    sandboxManager.stopTriggers();
  };
  
  self.getAppinfo = function(req, res) {
    res.status(200).send(params.appinfo);
  };
  
  self.getDefinition = function(req, res) {
    var clidef = {
      appinfo: params.appinfo,
      commands: commandManager.getDefinitions()
    };
    res.status(200).send(clidef);
  };
  
  self.postCommand = function(req, res) {
    var cmd = req.body || {};
    if (lodash.isString(cmd)) {
      cmd = JSON.parse(cmd);
    }
    switch(cmd.command) {
      case 'noop':
        break;
    }
    res.status(200).send({echo: cmd});
  };
  
  self.executeCommand = function(command, socket) {
    var listeners = { ws: socket };
    var cmd = command || {};
    if (lodash.isString(cmd)) {
      cmd = JSON.parse(cmd);
    }

    var promixe = commandManager.execute(cmd, listeners);
    return sendCommandOutput(socket, promixe, true);
  };

  var sendCommandOutput = function(socket, promise, finished) {
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
      if (finished) {
        socket.send(JSON.stringify({ state: constx.WEBSOCKET.STATE.DONE }));
      }
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

  debuglog(' - constructor has finished');
};

Controller.argumentSchema = {
  "id": "commandController",
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

util.inherits(Controller, events.EventEmitter);

module.exports = Controller;
