'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debugx = require('../utils/pinbug.js')('devebot:commandManager');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor start ...');

  params = params || {};

  var self = this;

  self.logger = params.loggingFactory.getLogger();

  var commandInstance = lodash.pick(params, [
    'appinfo',
    'loggingFactory',
    'sandboxManager'
  ]);

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
    debugx.enabled && debugx('Execute command: %s', JSON.stringify(command));
    self.logger.debug(' + Execute command: %s', JSON.stringify(command));
    var commands = this.getCommands();
    var cmd = command && commands[command.name] && commands[command.name].handler;
    if (typeof(cmd) !== 'function') {
      context.outlet.render('failed', { error: {
        reason: 'command_not_found'
      }});
      return;
    }
    var p = Promise.resolve(cmd.call(commandInstance, command.options, context));
    p.then(function(result) {
      if (!result._alreadyWrittenToOutlet) {
        debugx.enabled && debugx('Command [%s] has been completed', command.name);
        context.outlet.render('complete', { result: result });
      }
    }).catch(function(error) {
      if (!error._alreadyWrittenToOutlet) {
        debugx.enabled && debugx('Command [%s] has been failed', command.name);
        context.outlet.render('failed', { error: error });
      }
    }).finally(function() {
      debugx.enabled && debugx('Command [%s] has been done', command.name);
      context.outlet.render('done');
    });
  };

  params.pluginLoader.loadCommands(commandMap, {});

  debugx.enabled && debugx(' - constructor has finished');
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
