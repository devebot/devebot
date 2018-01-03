'use strict';

var Promise = require('bluebird');
var Injektor = require('injektor');
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
    tags: [ 'constructor-begin' ],
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
  var commandStore = new Injektor();

  var getCommands = function() {
    return (commandMap[constx.COMMAND.ROOT_KEY] = commandMap[constx.COMMAND.ROOT_KEY] || {});
  };

  var getCommand = function(cmdinfo) {
    if (!cmdinfo || !cmdinfo.name) return {};
    var fn = commandStore.suggest(cmdinfo.name);
    if (fn == null || fn.length == 0 || fn.length >= 2) return {};
    return commandStore.lookup(cmdinfo.name, {
      scope: cmdinfo.package
    });
  }

  self.getDefinitions = function(defs) {
    defs = defs || [];
    lodash.forOwn(getCommands(), function(value, key) {
      defs.push(lodash.assign({
        package: value.moduleId,
        name: value.name
      }, value.object && value.object.info));
    });
    return defs;
  };

  self.isAvailable = function(cmdinfo) {
    return (typeof(getCommand(cmdinfo).handler) === 'function');
  };

  self.execute = function(cmdinfo, context) {
    context = context || {};
    LX.has('debug') && LX.log('debug', LT.add({
      command: cmdinfo
    }).stringify({
      text: ' - Execute command: {command}',
      reset: true
    }));
    var command = getCommand(cmdinfo);
    var cmd = command && command.handler;
    if (typeof(cmd) !== 'function') {
      context.outlet.render('failed', { error: {
        reason: 'command_not_found'
      }});
      return;
    }
    Promise.resolve().then(function() {
      return cmd.call(buildCommandInstance(cmdinfo.name), cmdinfo.options, context);
    }).then(function(result) {
      if (!result._alreadyWrittenToOutlet) {
        LX.has('conlog') && LX.log('conlog', LT.add({
          commandName: cmdinfo.name
        }).stringify({
          text: ' - Command [{commandName}] is completed',
          reset: true
        }));
        context.outlet.render('complete', { result: result });
      }
    }).catch(function(error) {
      if (!error._alreadyWrittenToOutlet) {
        LX.has('conlog') && LX.log('conlog', LT.add({
          commandName: cmdinfo.name
        }).stringify({
          text: ' - Command [{commandName}] is failed',
          reset: true
        }));
        context.outlet.render('failed', { error: error });
      }
    }).finally(function() {
      LX.has('conlog') && LX.log('conlog', LT.add({
        commandName: cmdinfo.name
      }).stringify({
        text: ' - Command [{commandName}] has been done',
        reset: true
      }));
      context.outlet.render('done');
    });
  };

  params.pluginLoader.loadCommands(commandMap, {});

  lodash.forOwn(getCommands(), function(value, key) {
    commandStore.registerObject(value.name, value.object, { scope: value.moduleId });
  });

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
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
