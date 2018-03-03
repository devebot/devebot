'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var Injektor = require('injektor');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

/**
 * The constructor for RunhookManager class.
 *
 * @constructor
 * @param {Object} params - The parameters of the constructor.
 * @param {Object} params.runhook - The parameters that sent to Runhooks
 */
var Service = function(params) {
  params = params || {};
  var self = this;

  var getSandboxName = function() {
    return params.sandboxName;
  };

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: getSandboxName()
  }).toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  var runhookInstance = {
    sandboxName: params.sandboxName,
    sandboxConfig: params.sandboxConfig,
    loggingFactory: params.loggingFactory,
    service: params.injectedHandlers,
    injectedServices: params.injectedHandlers
  };

  var buildRunhookInstance = function(runhookName, runhookId) {
    return lodash.defaults({
      loggingFactory: params.loggingFactory.branch(runhookName, runhookId)
    }, runhookInstance);
  };

  var predefinedContext = lodash.get(params, [
      'profileConfig', constx.ROUTINE.ROOT_KEY, 'predefinedContext'
  ]) == true;

  var routineMap = {};
  var routineStore = new Injektor();

  var getRunhooks = function() {
    return (routineMap[constx.ROUTINE.ROOT_KEY] = routineMap[constx.ROUTINE.ROOT_KEY] || {});
  };

  var getRunhook = function(command) {
    if (!command || !command.name) return {};
    var fn = routineStore.suggest(command.name);
    if (fn == null || fn.length == 0 || fn.length >= 2) return {};
    return routineStore.lookup(command.name, {
      scope: command.package
    });
  }

  self.getDefinitions = function(defs) {
    defs = defs || [];
    lodash.forOwn(getRunhooks(), function(value, key) {
      defs.push(lodash.assign({
        package: value.moduleId,
        name: value.name
      }, value.object && value.object.info));
    });
    return defs;
  };

  self.isAvailable = function(command) {
    return lodash.isFunction(getRunhook(command).handler);
  };

  self.execute = function(command, context) {
    context = context || {};
    command = command || {};
    command.requestId = command.requestId || LT.getLogID();
    var reqTr = LT.branch({ key: 'requestId', value: command.requestId });
    LX.has('trace') && LX.log('trace', reqTr.add({
      commandName: command.name,
      command: command
    }).toMessage({
      text: '{commandName}#{requestId} - validate: {command}'
    }));
    var routine = getRunhook(command);
    var validationError = null;
    var payload = command.data;
    var schema = routine && routine.info && routine.info.schema;
    if (schema && lodash.isObject(schema)) {
      LX.has('conlog') && LX.log('conlog', reqTr.add({
        commandName: command.name,
        payload: payload,
        schema: schema
      }).toMessage({
        text: '{commandName}#{requestId} - validate payload: {payload} by schema: {schema}'
      }));
      var result = params.schemaValidator.validate(payload, schema);
      if (result.valid === false) {
        validationError = {
          message: 'failed validation using schema',
          schema: schema
        };
      }
    }
    var validate = routine && routine.info && routine.info.validate;
    if (validate && lodash.isFunction(validate)) {
      LX.has('conlog') && LX.log('conlog', reqTr.add({
        commandName: command.name,
        payload: payload
      }).toMessage({
        text: '{commandName}#{requestId} - validate payload: {payload} using validate()'
      }));
      if (!validate(payload)) {
        validationError = {
          message: 'failed validation using validate() function'
        };
      }
    }

    if (validationError) {
      context.outlet && context.outlet.render('failed', validationError);
      return Promise.reject(validationError);
    }

    LX.has('trace') && LX.log('trace', reqTr.add({
      commandName: command.name
    }).toMessage({
      text: '{commandName}#{requestId} - enqueue'
    }));

    var promize = null;
    var mode = routine.mode || command.mode;
    if (mode !== 'remote' || params.jobqueueBinder.enabled === false) {
      var progressMeter = self.createProgressMeter({
        progress: function(completed, total, data) {
          var percent = -1;
          if (lodash.isNumber(total) && total > 0 &&
              lodash.isNumber(completed) && completed >= 0 &&
              completed <= total) {
            percent = (total === 100) ? completed : lodash.round((completed * 100) / total);
          }
          context.outlet && context.outlet.render('progress', { progress: percent, data: data });
        }
      });
      promize = self.process(command, { progressMeter: progressMeter }).then(function(result) {
        context.outlet && context.outlet.render('completed', result);
        return Promise.resolve(result);
      }).catch(function(errorMessage) {
        context.outlet && context.outlet.render('failed', errorMessage);
        return Promise.reject(errorMessage);
      });
    } else {
      promize = params.jobqueueBinder.instance.enqueueJob(command).then(function(task) {
        return new Promise(function(onResolved, onRejected) {
          task
            .on('started', function(info) {
              context.outlet && context.outlet.render('started', info);
            })
            .on('progress', function(info) {
              context.outlet && context.outlet.render('progress', info);
            })
            .on('timeout', function(info) {
              context.outlet && context.outlet.render('timeout', info);
              onRejected({ state: 'timeout', data: info });
            })
            .on('cancelled', function(info) {
              context.outlet && context.outlet.render('cancelled', info);
              onRejected({ state: 'cancelled', data: info });
            })
            .on('failed', function(error) {
              context.outlet && context.outlet.render('failed', error);
              onRejected({ state: 'failed', data: error });
            })
            .on('completed', function(result) {
              context.outlet && context.outlet.render('completed', result);
              onResolved(result);
            });
        });
      });
    }
    return promize;
  };

  self.process = function(command, context) {
    context = context || {};
    command = command || {};
    command.requestId = command.requestId || LT.getLogID();
    var reqTr = LT.branch({ key: 'requestId', value: command.requestId });

    LX.has('trace') && LX.log('trace', reqTr.add({
      commandName: command.name,
      command: command
    }).toMessage({
      text: '{commandName}#{requestId} - process: {command}'
    }));

    var routine = getRunhook(command);
    var handler = routine && routine.handler;
    var options = command.options;
    var payload = command.data || command.payload;
    if (lodash.isFunction(handler)) {
      if (predefinedContext) {
        return Promise.resolve().then(handler.bind(null, options, payload, context));
      } else {
        LX.has('trace') && LX.log('trace', reqTr.add({
          commandName: command.name,
          command: command
        }).toMessage({
          text: '{commandName}#{requestId} - handler is invoked'
        }));
        return Promise.resolve().then(handler.bind(buildRunhookInstance(command.name), options, payload, context));
      }
    } else {
      return Promise.reject(lodash.assign({ reason: 'invalid_command_handler' }, command));
    }
  };

  self.createProgressMeter = function(args) {
    if (args && lodash.isFunction(args.progress)) {
      return {
        update: function(completed, total, extra) {
          args.progress(completed, total, extra);
        }
      }
    }
    return { update: function() {} }
  }

  params.pluginLoader.loadRoutines(routineMap, predefinedContext ? runhookInstance : {});

  lodash.forOwn(getRunhooks(), function(value, key) {
    routineStore.registerObject(value.name, value.object, { scope: value.moduleId });
  });

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.argumentSchema = {
  "$id": "runhookManager",
  "type": "object",
  "properties": {
    "sandboxName": {
      "type": "string"
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "injectedHandlers": {
      "type": "object"
    },
    "jobqueueBinder": {
      "type": "object"
    },
    "pluginLoader": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    }
  }
};

Service.prototype.getServiceInfo = function() {
  return {};
};

Service.prototype.getServiceHelp = function() {
  return [];
};

module.exports = Service;
