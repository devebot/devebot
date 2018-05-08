'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');
const blockRef = chores.getBlockRef(__filename);

function ScriptExecutor(params) {
  params = params || {};

  let self = this;
  let loggingFactory = params.loggingFactory.branch(blockRef);
  let LX = loggingFactory.getLogger();
  let LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let sandboxManager = params.sandboxManager;
  let runhookManager = sandboxManager.getRunhookManager();

  let resolveCommand = function(command) {
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
      LX.has('error') && LX.log('error', LT.toMessage({
        tags: [ blockRef, 'executeCommand', 'invalid-command-object' ],
        text: ' - Invalid command object'
      }));
      outlet.render('error');
      return;
    }

    let reqTr = LT.branch({ key: 'requestId', value: command.requestId });

    LX.has('info') && LX.log('info', reqTr.add({
      commandName: command.name,
      command: command
    }).toMessage({
      tags: [ blockRef, 'executeCommand', 'begin' ],
      text: '{commandName}#{requestId} start, details: {command}'
    }));

    let promize;
    if (command.name == 'definition') {
      promize = Promise.resolve().then(function() {
        outlet.render('definition', {
          value: {
            appName: params.appName,
            appInfo: params.appInfo,
            appinfo: params.appInfo, // deprecated
            commands: runhookManager.getDefinitions()
          }
        });
      });
    } else {
      promize = runhookManager.execute(command, { outlet: outlet });
    }

    promize.catch(function(error) {
      LX.has('silly') && LX.log('silly', reqTr.add({
        commandName: command.name
      }).toMessage({
        tags: [ blockRef, 'executeCommand', 'failed' ],
        text: '{commandName}#{requestId} is failed'
      }));
    }).finally(function() {
      LX.has('info') && LX.log('info', reqTr.add({
        commandName: command.name
      }).toMessage({
        tags: [ blockRef, 'executeCommand', 'done' ],
        text: '{commandName}#{requestId} has done'
      }));
      outlet.render('done');
    });
  };

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

ScriptExecutor.argumentSchema = {
  "$id": "scriptExecutor",
  "type": "object",
  "properties": {
    "appName": {
      "type": "string"
    },
    "appInfo": {
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
