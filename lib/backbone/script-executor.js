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
          commands: runhookManager.getDefinitions()
        }
      });
      return;
    }

    var context = { outlet: outlet };
    runhookManager.execute(cmd, context).catch(function(error) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        commandName: cmd.name
      }).stringify({
        text: ' - runhookManager.execute("{commandName}") is failed',
        reset: true
      }));
    }).finally(function() {
      LX.has('conlog') && LX.log('conlog', LT.add({
        commandName: cmd.name
      }).stringify({
        text: ' - runhookManager.execute("{commandName}") will be closed',
        reset: true
      }));
      context.outlet.render('done');
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
