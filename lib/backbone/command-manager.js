'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var Service = function(params) {
  var self = this;
  params = params || {};

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    text: ' + constructor start ...'
  }));

  var commandInstance = lodash.pick(params, [
    'appinfo',
    'loggingFactory',
    'sandboxManager'
  ]);

  var buildCommandInstance = function(commandName, commandId) {
    return lodash.defaults({
      loggingFactory: params.loggingFactory.branch(commandName, commandId)
    }, commandInstance);
  };

  var commandMap = {};

  self.getCommands = function() {
    return (commandMap[constx.COMMAND.ROOT_KEY] || {});
  };

  self.getDefinitions = function(defs) {
    defs = defs || [];
    var commands = this.getCommands();
    lodash.forOwn(commands, function(value, key) {
      defs.push(lodash.assign({name: key}, value.info));
    });
    return defs;
  };

  self.isAvailable = function(command) {
    var commands = self.getCommands();
    return command && command.name && commands[command.name] &&
        typeof(commands[command.name].handler) === 'function';
  };

  self.execute = function(command, context) {
    context = context || {};
    LX.has('debug') && LX.log('debug', LT.add({
      command: command
    }).stringify({
      text: ' - Execute command: {command}',
      reset: true
    }));
    var commands = this.getCommands();
    var cmd = command && commands[command.name] && commands[command.name].handler;
    if (typeof(cmd) !== 'function') {
      context.outlet.render('failed', { error: {
        reason: 'command_not_found'
      }});
      return;
    }
    Promise.resolve().then(function() {
      return cmd.call(buildCommandInstance(command.name), command.options, context);
    }).then(function(result) {
      if (!result._alreadyWrittenToOutlet) {
        LX.has('conlog') && LX.log('conlog', LT.add({
          commandName: command.name
        }).stringify({
          text: ' - Command [{commandName}] is completed',
          reset: true
        }));
        context.outlet.render('complete', { result: result });
      }
    }).catch(function(error) {
      if (!error._alreadyWrittenToOutlet) {
        LX.has('conlog') && LX.log('conlog', LT.add({
          commandName: command.name
        }).stringify({
          text: ' - Command [{commandName}] is failed',
          reset: true
        }));
        context.outlet.render('failed', { error: error });
      }
    }).finally(function() {
      LX.has('conlog') && LX.log('conlog', LT.add({
        commandName: command.name
      }).stringify({
        text: ' - Command [{commandName}] has been done',
        reset: true
      }));
      context.outlet.render('done');
    });
  };

  params.pluginLoader.loadCommands(commandMap, {});

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    text: ' - constructor has finished'
  }));
};

Service.argumentSchema = {
  "id": "commandManager",
  "type": "object",
  "properties": {
    "appinfo": {
      "type": "object"
    },
    "pluginLoader": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    },
    "sandboxManager": {
      "type": "object"
    }
  }
};

module.exports = Service;
