'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var lodash = require('lodash');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');

var Service = function(params) {
  Service.super_.call(this);

  params = params || {};
  
  var self = this;

  var scriptfolders = params.scriptfolders || [];
  var generalconfig = params.generalconfig || {};
  var profileconfig = params.profileconfig || {};

  var loggingFactory = params.loggingFactory;
  self.logger = loggingFactory.getLogger();

  var sandboxManager = params.sandboxManager;

  var commandInstance = {};
  
  var commandContext = lodash.pick(params, [
    'loggingFactory',
    'sandboxManager'
  ]);

  var commandMap = {};

  self.getCommands = function() {
    return (commandMap[constx.COMMAND.ROOT_KEY] || {});
  };

  self.getDefinitions = function() {
    var commands = this.getCommands();
    var defs = [];
    lodash.forOwn(commands, function(value, key) {
      defs.push(lodash.assign({name: key}, value.info));
    });
    return defs;
  };

  self.isAvailable = function(name) {
    var commands = this.getCommands();
    return (lodash.isObject(commands[name]));
  };

  self.execute = function(cmddef) {
    self.logger.debug(' + Execute command: %s', JSON.stringify(cmddef));
    var commands = this.getCommands();
    var cmdobj = commands[cmddef.command];
    if (!cmdobj) {
      throw new Error('command_not_found');
    }
    return cmdobj.handler.call(commandInstance, cmddef.options, commandContext);
  };

  scriptfolders.forEach(function(folder) {
    chores.loadScriptEntries.call(self, commandMap, folder, constx.COMMAND.ROOT_KEY, {});
  });
};

Service.argumentSchema = {
  "id": "/commandManager",
  "type": "object",
  "properties": {
    "scriptfolders": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "generalconfig": {
      "type": "object"
    },
    "profileconfig": {
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

util.inherits(Service, events.EventEmitter);

module.exports = Service;