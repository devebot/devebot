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
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  var sandboxManager = params.sandboxManager;
  var runhookManager = sandboxManager.getSandboxService('runhookManager', chores.injektorContext);

  var resolveCommand = function(command) {
    command = command || {};
    command = lodash.isString(command) ? JSON.parse(command) : command;
    // rename "command" field -> "name" field
    command.name = command.name || command.command;
    delete command.command;
    // support requestId
    command.requestId = command.requestId || LT.getLogID();
    return command;
  }

  self.executeCommand = function(command, outlet) {
    try {
      command = resolveCommand(command);
    } catch(error) {
      LX.has('error') && LX.log('error', LT.stringify({
        tick: 'DEVEBOT_CMD_INVALID_OBJECT',
        text: ' - Invalid command object'
      }));
      outlet.render('error');
      return;
    }

    var reqTr = LT.branch({ key: 'requestId', value: command.requestId });

    LX.has('info') && LX.log('info', reqTr.add({
      commandName: command.name,
      command: command
    }).stringify({
      tick: 'DEVEBOT_CMD_BEGIN',
      text: ' - Command "{commandName}" start, details: {command}'
    }));

    var promize;
    if (command.name == 'definition') {
      promize = Promise.resolve().then(function() {
        outlet.render('definition', {
          value: {
            appinfo: params.appinfo,
            commands: runhookManager.getDefinitions()
          }
        });
      });
    } else {
      promize = runhookManager.execute(command, { outlet: outlet });
    }

    promize.catch(function(error) {
      LX.has('conlog') && LX.log('conlog', reqTr.add({
        commandName: command.name
      }).stringify({
        text: ' - Command "{commandName}" is failed',
        reset: true
      }));
    }).finally(function() {
      LX.has('info') && LX.log('info', reqTr.add({
        commandName: command.name
      }).stringify({
        tick: 'DEVEBOT_CMD_END',
        text: ' - Command "{commandName}" has done',
        reset: true
      }));
      outlet.render('done');
    });
  };

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
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
    "sandboxManager": {
      "type": "object"
    }
  }
};

module.exports = ScriptExecutor;
