'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');

var ScriptExecutor = function(params) {
  var self = this;
  params = params || {};

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    text: ' + constructor start ...'
  }));

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

    LX.has('conlog') && LX.log('conlog', LT.add({
      command: cmd
    }).stringify({
      text: ' - Command object: {command}'
    }));

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

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    text: ' - constructor has finished'
  }));
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
