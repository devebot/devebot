'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');
const blockRef = chores.getBlockRef(__filename);

function ScriptExecutor(params = {}) {
  const loggingFactory = params.loggingFactory.branch(blockRef);
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  const sandboxManager = params.sandboxManager;
  const runhookManager = sandboxManager.getRunhookManager();

  function resolveCommand(command) {
    command = command || {};
    command = lodash.isString(command) ? JSON.parse(command) : command;
    // rename "command" field -> "name" field
    command.name = command.name || command.command;
    delete command.command;
    // support requestId
    command.requestId = command.requestId || T.getLogID();
    return command;
  }

  this.executeCommand = function(command, outlet) {
    try {
      command = resolveCommand(command);
    } catch (error) {
      L.has('error') && L.log('error', T.toMessage({
        tags: [ blockRef, 'executeCommand', 'invalid-command-object' ],
        text: ' - Invalid command object'
      }));
      outlet.render('error');
      return;
    }

    const reqTr = T.branch({ key: 'requestId', value: command.requestId });

    L.has('info') && L.log('info', reqTr.add({ commandName: command.name, command }).toMessage({
      tags: [ blockRef, 'executeCommand', 'begin' ],
      text: '${commandName}#${requestId} start, details: {command}'
    }));

    let promize;
    if (command.name === 'definition') {
      promize = Promise.resolve().then(function() {
        outlet.render('definition', {
          appName: params.appName,
          appInfo: params.appInfo,
          commands: runhookManager.getDefinitions()
        });
      });
    } else {
      promize = runhookManager.execute(command, { outlet: outlet });
    }

    promize.catch(function() {
      L.has('silly') && L.log('silly', reqTr.add({ commandName: command.name }).toMessage({
        tags: [ blockRef, 'executeCommand', 'failed' ],
        text: '${commandName}#${requestId} is failed'
      }));
    }).finally(function() {
      L.has('info') && L.log('info', reqTr.add({ commandName: command.name }).toMessage({
        tags: [ blockRef, 'executeCommand', 'done' ],
        text: '${commandName}#${requestId} has done'
      }));
      outlet.render('done');
    });
  };

  L.has('silly') && L.log('silly', T.toMessage({
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
