'use strict';

const Promise = require('bluebird');
const Injektor = require('injektor');
const lodash = require('lodash');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const blockRef = chores.getBlockRef(__filename);

/**
 * The constructor for RunhookManager class.
 *
 * @constructor
 * @param {Object} params - The parameters of the constructor.
 * @param {Object} params.runhook - The parameters that sent to Runhooks
 */
function RunhookManager(params = {}) {
  const loggingFactory = params.loggingFactory.branch(blockRef);
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  L.has('silly') && L.log('silly', T.add({ sandboxName: params.sandboxName }).toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  const runhookInstance = {
    appName: params.appName,
    appInfo: params.appInfo,
    sandboxName: params.sandboxName,
    sandboxConfig: params.sandboxConfig,
    loggingFactory: params.loggingFactory,
    service: params.injectedHandlers, //@Deprecated, injectedServices
    injectedServices: params.injectedHandlers
  };

  /**
   * @param {Object} command
   * @param {string} command.name - The name of the command/routine.
   * @param {string} command.package - The package on which this command/routine belongs to.
   * @param {string} command.requestId - The requestId.
   */
  function buildRunhookInstance(command, runhookId) {
    runhookId = runhookId || command.requestId;
    const customized = {
      loggingFactory: params.loggingFactory.branch(command.name, runhookId)
    }
    if (command.package && !chores.isSpecialBundle(command.package)) {
      if (params.injectedServices && params.injectedServices[command.package]) {
        customized.injectedServices = params.injectedServices[command.package];
      }
    }
    return lodash.defaults(customized, runhookInstance);
  };

  // default: undefined ~ false
  const predefinedContext = lodash.get(params, ['profileConfig', constx.ROUTINE.ROOT_KEY, 'predefinedContext']) === true;

  const routineStore = new Injektor(chores.injektorOptions);

  const routineMap = {};

  function getRunhooks() {
    return routineMap;
  };

  function getRunhook(command) {
    if (!command || !command.name) {
      return {
        code: -1,
        message: 'command.name is undefined'
      };
    }
    const fn = routineStore.suggestName(command.name);
    if (fn == null || fn.length === 0) {
      return {
        code: -2,
        message: 'command.name not found'
      };
    }
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

  this.getDefinitions = function(defs) {
    defs = defs || [];
    lodash.forOwn(getRunhooks(), function(value, key) {
      defs.push(lodash.assign({
        package: value.crateScope,
        name: value.name
      }, value.object && value.object.info));
    });
    return defs;
  };

  this.getRunhook = function(command) {
    return getRunhook(command);
  }

  this.isAvailable = function(command) {
    return lodash.isFunction(getRunhook(command).handler);
  };

  this.execute = function(command, context) {
    const self = this;
    context = context || {};
    command = command || {};
    command.requestId = command.requestId || T.getLogID();
    const reqTr = T.branch({ key: 'requestId', value: command.requestId });
    L.has('trace') && L.log('trace', reqTr.add({ commandName: command.name, command }).toMessage({
      tags: [ blockRef, 'execute', 'begin' ],
      text: '${commandName}#${requestId} - validate: {command}'
    }));

    const routine = getRunhook(command);
    let validationError = null;

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

    const payload = command.payload || command.data;
    const schema = routine && routine.info && routine.info.schema;
    if (schema && lodash.isObject(schema)) {
      L.has('silly') && L.log('silly', reqTr.add({ commandName: command.name, payload, schema }).toMessage({
        tags: [ blockRef, 'execute', 'validate-by-schema' ],
        text: '${commandName}#${requestId} - validate payload: {payload} by schema: {schema}'
      }));
      const result = params.schemaValidator.validate(payload, schema);
      if (result.valid === false) {
        validationError = {
          message: 'failed validation using schema',
          schema: schema
        };
      }
    }
    const validate = routine && routine.info && routine.info.validate;
    if (validate && lodash.isFunction(validate)) {
      L.has('silly') && L.log('silly', reqTr.add({ commandName: command.name, payload }).toMessage({
        tags: [ blockRef, 'execute', 'validate-by-method' ],
        text: '${commandName}#${requestId} - validate payload: {payload} using validate()'
      }));
      if (!validate(payload)) {
        validationError = {
          message: 'failed validation using validate() function'
        };
      }
    }

    if (validationError) {
      L.has('error') && L.log('error', reqTr.add({ commandName: command.name, validationError }).toMessage({
        tags: [ blockRef, 'execute', 'validation-error' ],
        text: '${commandName}#${requestId} - validation error: {validationError}'
      }));
      context.outlet && context.outlet.render('failed', validationError);
      return Promise.reject(validationError);
    }

    L.has('trace') && L.log('trace', reqTr.add({ commandName: command.name }).toMessage({
      tags: [ blockRef, 'execute', 'enqueue' ],
      text: '${commandName}#${requestId} - processing'
    }));

    let promize = null;
    const mode = routine.mode || command.mode;
    if (mode !== 'remote' || params.jobqueueBinder.enabled === false) {
      const progressMeter = self.createProgressMeter({
        progress: function(completed, total, data) {
          const ok = lodash.isNumber(total) && total > 0 && lodash.isNumber(completed) && completed >= 0 && completed <= total;
          const percent = ok ? ((total === 100) ? completed : lodash.round((completed * 100) / total)) : -1;
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

  this.process = function(command, context) {
    context = context || {};
    command = command || {};
    command.requestId = command.requestId || T.getLogID();
    const reqTr = T.branch({ key: 'requestId', value: command.requestId });

    L.has('trace') && L.log('trace', reqTr.add({ commandName: command.name, command }).toMessage({
      tags: [ blockRef, 'process', 'begin' ],
      text: '${commandName}#${requestId} - process: {command}'
    }));

    const routine = getRunhook(command);
    const handler = routine && routine.handler;
    const options = command.options;
    const payload = command.payload || command.data;
    if (lodash.isFunction(handler)) {
      L.has('trace') && L.log('trace', reqTr.add({
        commandName: command.name,
        command: command,
        predefinedContext: predefinedContext
      }).toMessage({
        tags: [ blockRef, 'process', 'handler-invoked' ],
        text: '${commandName}#${requestId} - handler is invoked'
      }));
      if (predefinedContext) {
        return Promise.resolve().then(handler.bind(null, options, payload, context));
      } else {
        return Promise.resolve().then(handler.bind(buildRunhookInstance(command), options, payload, context));
      }
    } else {
      return Promise.reject(lodash.assign({ reason: 'invalid_command_handler' }, command));
    }
  };

  this.createProgressMeter = function(args) {
    if (args && lodash.isFunction(args.progress)) {
      return {
        update: function(completed, total, extra) {
          args.progress(completed, total, extra);
        }
      }
    }
    return { update: function() {} }
  }

  params.bundleLoader.loadRoutines(routineMap, predefinedContext ? runhookInstance : {});

  lodash.forOwn(getRunhooks(), function(value, key) {
    routineStore.registerObject(value.name, value.object, { scope: value.crateScope });
  });

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

RunhookManager.argumentSchema = {
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
    "bundleLoader": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    }
  }
};

module.exports = RunhookManager;
