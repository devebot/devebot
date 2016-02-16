'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var Validator = require('jsonschema').Validator;
var validator = new Validator();

var Injektor = require('injektor');

var LoggingFactory = require('../services/logging-factory.js');
var CommandManager = require('../services/command-manager.js');
var SandboxManager = require('../services/sandbox-manager.js');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

function init(params) {
  
  var injektor = new Injektor();

  injektor
    .registerObject('scriptfolders', params['scriptfolders'])
    .registerObject('generalconfig', params['general']['default'])
    .registerObject('profileconfig', params['profile']['default'])
    .registerObject('sandboxList', params['sandbox']['context'])
    .defineService('loggingFactory', LoggingFactory)
    .defineService('commandManager', CommandManager)
    .defineService('sandboxManager', SandboxManager);

  var commandManager = injektor.lookup('commandManager');
  var sandboxManager = injektor.lookup('sandboxManager');

  var controller = {};
  
  controller.startDaemons = function() {
    sandboxManager.startTriggers();
  };
  
  controller.stopDaemons = function() {
    sandboxManager.stopTriggers();
  };
  
  controller.getAppinfo = function(req, res) {
    res.status(200).send(params.APPINFO);
  };
  
  controller.getDefinition = function(req, res) {
    var clidef = {
      appinfo: params.APPINFO,
      commands: commandManager.getDefinitions()
    };
    res.status(200).send(clidef);
  };
  
  controller.postCommand = function(req, res) {
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
  
  controller.executeCommand = function(command, socket) {
    var listeners = { ws: socket };
    var cmd = command || {};
    if (lodash.isString(cmd)) {
      cmd = JSON.parse(cmd);
    }

    var promixe = commandManager.execute(cmd);
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
    var title = isError ? constx.WEBSOCKET.MSG_ON.FAILURE : constx.WEBSOCKET.MSG_ON.SUCCESS;
    var valresult = validator.validate(output, constx.WEBSOCKET.DETAILS.SCHEMA);
    if (valresult.errors.length > 0) {
      return [{ type: 'json', title: title, data: output }];
    }
    return output;
  };

  return controller;
}

module.exports = init;