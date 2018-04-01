'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var Injektor = require('injektor');
var lodash = require('lodash');
var chores = require('../utils/chores');
var constx = require('../utils/constx');

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

  var blockRef = chores.getBlockRef(__filename);
  var loggingFactory = params.loggingFactory.branch(blockRef);
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.add({
    sandboxName: params.sandboxName
  }).toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  var runhookInstance = {
    appName: params.appName,
    appInfo: params.appInfo,
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
  var routineStore = new Injektor(chores.injektorOptions);

  var getRunhooks = function() {
    return (routineMap = routineMap || {});
  };

  var getRunhook = function(command) {
    if (!command || !command.name) return {
      code: -1,
      message: 'command.name is undefined'
    };
    var fn = routineStore.suggestName(command.name);
    if (fn == null || fn.length == 0) return {
      code: -2,
      message: 'command.name not found'
    };
    if (fn.length >= 2) {
      try {
        return routineStore.lookup(command.name, {
          scope: command.package
        });
      } catch (err) {
        if (err.name === 'DuplicatedRelativeNameError') {
          return {
            code: -3,
            message: 'command.name is duplicated'
          };
        } else {
          return {
            code: -9,
            message: 'unknown error'
          };
        }
      }
    }
    return routineStore.lookup(fn[0]);
  }

  self.getDefinitions = function(defs) {
    defs = defs || [];
    lodash.forOwn(getRunhooks(), function(value, key) {
      defs.push(lodash.assign({
        package: value.crateScope,
        name: value.name
      }, value.object && value.object.info));
    });
    return defs;
  };

  self.getRunhook = function(command) {
    return getRunhook(command);
  }

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
      tags: [ blockRef, 'execute', 'begin' ],
      text: '{commandName}#{requestId} - validate: {command}'
    }));

    var routine = getRunhook(command);
    var validationError = null;

    if (lodash.isEmpty(routine) || routine.code === -1) {
      validationError = {
        message: routine.message || 'command.name is undefined'
      }
    }
    if (routine.code === -2) {
      validationError = {
        name: command.name,
        message: routine.message || 'command.name not found'
      }
    }
    if (routine.code === -3) {
      validationError = {
        name: command.name,
        message: routine.message || 'command.name is duplicated'
      }
    }

    if (validationError) {
      context.outlet && context.outlet.render('invalid', validationError);
      return Promise.reject(validationError);
    }

    var payload = command.data;
    var schema = routine && routine.info && routine.info.schema;
    if (schema && lodash.isObject(schema)) {
      LX.has('silly') && LX.log('silly', reqTr.add({
        commandName: command.name,
        payload: payload,
        schema: schema
      }).toMessage({
        tags: [ blockRef, 'execute', 'validate-by-schema' ],
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
      LX.has('silly') && LX.log('silly', reqTr.add({
        commandName: command.name,
        payload: payload
      }).toMessage({
        tags: [ blockRef, 'execute', 'validate-by-method' ],
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
      tags: [ blockRef, 'execute', 'enqueue' ],
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
      tags: [ blockRef, 'process', 'begin' ],
      text: '{commandName}#{requestId} - process: {command}'
    }));

    var routine = getRunhook(command);
    var handler = routine && routine.handler;
    var options = command.options;
    var payload = command.data || command.payload;
    if (lodash.isFunction(handler)) {
      LX.has('trace') && LX.log('trace', reqTr.add({
        commandName: command.name,
        command: command,
        predefinedContext: predefinedContext
      }).toMessage({
        tags: [ blockRef, 'process', 'handler-invoked' ],
        text: '{commandName}#{requestId} - handler is invoked'
      }));
      if (predefinedContext) {
        return Promise.resolve().then(handler.bind(null, options, payload, context));
      } else {
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
    routineStore.registerObject(value.name, value.object, { scope: value.crateScope });
  });

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.argumentSchema = {
  "$id": "runhookManager",
  "type": "object",
  "properties": {
    "appName": {
      "type": "string"
    },
    "appInfo": {
      "type": "object"
    },
    "sandboxName": {
      "type": "string"
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileName": {
      "type": "string"
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
