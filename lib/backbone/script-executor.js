'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var debugx = require('../utils/pinbug.js')('devebot:scriptExecutor');

var ScriptExecutor = function(params) {
  debugx.enabled && debugx(' + constructor start ...');

  var self = this;

  var commandManager = params.commandManager;

  var fixCmdName = function(cmd) {
    cmd.name = cmd.name || cmd.command;
    delete cmd.command;
    return cmd;
  }

  self.executeCommand = function(command, outlet) {
    var cmd = command || {};
    cmd = fixCmdName(lodash.isString(cmd) ? JSON.parse(cmd) : cmd);

    debugx.enabled && debugx('Command object: %s', JSON.stringify(cmd));

    if (cmd.name == 'definition') {
      outlet.render('definition', {
        value: {
          appinfo: params.appinfo,
          commands: commandManager.getDefinitions()
        }
      });
      return;
    }

    commandManager.execute(cmd, { outlet: outlet });
  };

  debugx.enabled && debugx(' - constructor has finished');
};

ScriptExecutor.argumentSchema = {
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
    }
  }
};

module.exports = ScriptExecutor;
