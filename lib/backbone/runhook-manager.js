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
  }).stringify({
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

  var getRunhook = function(runinfo) {
    if (!runinfo || !runinfo.name) return {};
    var fn = routineStore.suggest(runinfo.name);
    if (fn == null || fn.length == 0 || fn.length >= 2) return {};
    return routineStore.lookup(runinfo.name, {
      scope: runinfo.package
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

  self.isAvailable = function(runinfo) {
    return lodash.isFunction(getRunhook(runinfo).handler);
  };

  self.execute = function(runinfo, context) {
    var runhook = getRunhook(runinfo);
    LX.has('trace') && LX.log('trace', LT.add({
      sandboxName: getSandboxName(),
      runhook: runinfo
    }).stringify({
      text: 'runhookManager on sandbox<{sandboxName}> - runhook: <{runinfo}> - validate'
    }));
    var validationError = null;
    var payload = runinfo.data;
    var schema = runhook && runhook.info && runhook.info.schema;
    if (schema && lodash.isObject(schema)) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        sandboxName: getSandboxName(),
        payload: payload,
        schema: schema
      }).stringify({
        text: 'validate runhook payload: {payload} using schema: {schema}'
      }));
      var result = params.schemaValidator.validate(payload, schema);
      if (result.valid === false) {
        validationError = {
          message: 'failed validation using schema',
          schema: schema
        };
      }
    }
    var validate = runhook && runhook.info && runhook.info.validate;
    if (validate && lodash.isFunction(validate)) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        sandboxName: getSandboxName(),
        payload: payload
      }).stringify({
        text: 'validate runhook payload: {payload} using validate() function'
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

    LX.has('trace') && LX.log('trace', 'runhookManager on sandbox[%s] - runhook: %s - enqueue',
      getSandboxName(), JSON.stringify(runinfo));

    var promize = null;
    if (runinfo.mode !== 'remote' || params.jobqueueMaster.enabled === false) {
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
      promize = self.process(runinfo, { progressMeter: progressMeter }).then(function(result) {
        context.outlet && context.outlet.render('completed', result);
        return Promise.resolve(result);
      }).catch(function(errorMessage) {
        context.outlet && context.outlet.render('failed', errorMessage);
        return Promise.reject(errorMessage);
      });
    } else {
      promize = params.jobqueueMaster.instance.enqueueJob(runinfo).then(function(task) {
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

  self.process = function(runinfo, context) {
    runinfo = runinfo || {};
    context = context || {};

    LX.has('trace') && LX.log('trace', 'runhookManager on sandbox[%s] - runinfo: %s - process',
      getSandboxName(), JSON.stringify(runinfo));

    var runhook = getRunhook(runinfo);
    var handler = runhook && runhook.handler;
    var options = runinfo.options;
    var payload = runinfo.data;
    if (lodash.isFunction(handler)) {
      if (predefinedContext) {
        return Promise.resolve().then(handler.bind(null, options, payload, context));
      } else {
        return Promise.resolve().then(handler.bind(buildRunhookInstance(runinfo.name), options, payload, context));
      }
    } else {
      return Promise.reject(lodash.assign({ reason: 'invalid_runinfo_handler' }, runinfo));
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

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.argumentSchema = {
  "id": "runhookManager",
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
    "jobqueueMaster": {
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
