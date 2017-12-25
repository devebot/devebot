'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var LogAdapter = require('logolite').LogAdapter;
var LX = LogAdapter.getLogger({ scope: 'devebot:runhookManager' });
var LogTracer = require('logolite').LogTracer;

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

  var LT = LogTracer.ROOT
      .branch({ key: 'serviceName', value: 'runhookManager' })
      .branch({ key: 'serviceId', value: LogTracer.getLogID() });

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: getSandboxName()
  }).stringify({
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  var runhookInstance = {
    sandboxName: params.sandboxName,
    sandboxConfig: params.sandboxConfig,
    loggingFactory: params.loggingFactory,
    service: params.injectedHandlers,
    injectedServices: params.injectedHandlers
  };

  var predefinedContext = lodash.get(params, [
      'profileConfig', constx.RUNHOOK.ROOT_KEY, 'predefinedContext'
  ]) == true;

  var runhookMap = {};

  self.getRunhooks = function() {
    return (runhookMap[constx.RUNHOOK.ROOT_KEY] || {});
  };

  self.getDefinitions = function(defs) {
    defs = defs || [];
    lodash.forOwn(self.getRunhooks(), function(value, key) {
      defs.push(lodash.assign({name: key}, value.info));
    });
    return defs;
  };

  self.isAvailable = function(runhook) {
    var runhooks = this.getRunhooks();
    return runhook && runhook.name &&
        runhooks[runhook.name] &&
        lodash.isFunction(runhooks[runhook.name].handler);
  };

  self.execute = function(runhook, context) {
    var runhooks = self.getRunhooks();
    LX.has('trace') && LX.log('trace', LT.add({
      sandboxName: getSandboxName(),
      runhook: runhook
    }).stringify({
      text: 'runhookManager on sandbox<{sandboxName}> - runhook: <{runhook}> - validate'
    }));
    var validationError = null;
    var payload = runhook.data;
    var schema = runhooks[runhook.name] && runhooks[runhook.name].info &&
        runhooks[runhook.name].info.schema;
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
    var validate = runhooks[runhook.name] && runhooks[runhook.name].info &&
        runhooks[runhook.name].info.validate;
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
      context.outlet && context.outlet.render('failed', { error: validationError });
      return Promise.reject(validationError);
    }

    LX.has('trace') && LX.log('trace', 'runhookManager on sandbox[%s] - runhook: %s - enqueue',
      getSandboxName(), JSON.stringify(runhook));

    if (runhook.mode !== 'remote' || params.jobqueueMaster.enabled === false) {
      var progressMeter = self.createProgressMeter({
        job: {
          progress: function(completed, total, data) {
            var percent = -1;
            if (lodash.isNumber(total) && total > 0 &&
                lodash.isNumber(completed) && completed >= 0 &&
                completed <= total) {
              percent = (total === 100) ? completed : lodash.round((completed * 100) / total);
            }
            context.outlet && context.outlet.render('progress', { progress: percent, data: data });
          }
        }
      });
      return self.process(runhook, progressMeter).then(function(result) {
        context.outlet && context.outlet.render('complete', { result: result });
        return Promise.resolve(result);
      }).catch(function(errorMessage) {
        context.outlet && context.outlet.render('failed', { error: errorMessage });
        return Promise.reject(errorMessage);
      });
    } else {
      return params.jobqueueMaster.enqueueJob(runhook, context);
    }
  };

  self.process = function(runhook, progressMeter) {
    runhook = runhook || {};

    LX.has('trace') && LX.log('trace', 'runhookManager on sandbox[%s] - runhook: %s - process',
      getSandboxName(), JSON.stringify(runhook));

    var runhooks = self.getRunhooks();
    var handler = runhooks[runhook.name] && runhooks[runhook.name].handler;
    var payload = runhook.data;
    var context = { progressMeter: progressMeter }
    if (lodash.isFunction(handler)) {
      if (predefinedContext) {
        return Promise.resolve(handler(payload, context));
      } else {
        return Promise.resolve(handler.call(runhookInstance, payload, context));
      }
    } else {
      return Promise.reject(lodash.assign({ reason: 'invalid_runhook_handler' }, runhook));
    }
  };

  self.createProgressMeter = function(args) {
    if (args && args.job && lodash.isFunction(args.job.progress)) {
      return {
        update: function(completed, total, extra) {
          args.job.progress(completed, total, extra);
        }
      }
    }
    return { update: function() {} }
  }

  params.pluginLoader.loadRunhooks(runhookMap, predefinedContext ? runhookInstance : {});

  LX.has('conlog') && LX.log('conlog', LT.stringify({
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
