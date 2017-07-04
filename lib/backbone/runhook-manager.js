'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var lodash = require('lodash');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debugx = require('../utils/debug.js')('devebot:runhookManager');

/**
 * The constructor for RunhookManager class.
 *
 * @constructor
 * @param {Object} params - The parameters of the constructor.
 * @param {Object} params.runhook - The parameters that sent to Runhooks
 */
var Service = function(params) {
  debugx.enabled && debugx(' + constructor start ...');

  params = params || {};

  var self = this;

  self.logger = params.loggingFactory.getLogger();

  var runhookInstance = {
    sandboxName: params.sandboxName,
    sandboxConfig: params.sandboxConfig,
    service: {
      loggingFactory: params.loggingFactory
    }
  };

  lodash.forEach(params.injectedServices, function(serviceName) {
    runhookInstance.service[serviceName] = params[serviceName];
  });

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  debugx.enabled && debugx(' - create a runhook-manager instance in <%s>', self.getSandboxName());

  var runhookMap = {};

  var getRunhooks = self.getRunhooks = function() {
    return (runhookMap[constx.RUNHOOK.ROOT_KEY] || {});
  };

  var useLoadingContext = function() {
    return lodash.get(params, ['profileConfig', constx.RUNHOOK.ROOT_KEY, 'context_passed_at_loading']) == true;
  };

  var isRunhookPathAsc = function() {
    return true;
  };

  var getRunhookOp = function(runhook) {
    runhook = runhook || {};
    var routine = runhook.routine;
    var entity = runhook.entity || 'default';
    var operation = runhook.operation || 'default';
    var runhooks = getRunhooks();
    if (isRunhookPathAsc()) {
      return runhooks &&
        runhooks[routine] &&
        runhooks[routine][entity] &&
        runhooks[routine][entity][operation];
    } else {
      return runhooks &&
        runhooks[entity] &&
        runhooks[entity][routine] &&
        runhooks[entity][routine][operation];
    }
  }

  self.getRunhookEntities = function(routine) {
    var runhooks = self.getRunhooks();

    var modelsByRoutine = [];
    if (isRunhookPathAsc()) {
      if (lodash.isObject(runhooks[routine])) {
        modelsByRoutine = lodash.keys(runhooks[routine]);
      }
    } else {
      var models = lodash.keys(runhooks) || [];
      for(var i=0; i<models.length; i++) {
        if (lodash.isObject(runhooks[models[i]]) &&
            lodash.isObject(runhooks[models[i]][routine])) {
          modelsByRoutine.push(models[i]);
        }
      }
    }
    return modelsByRoutine;
  };

  self.getRunhookOperations = function(routine, entity) {
    var runhooks = self.getRunhooks();
    if (isRunhookPathAsc()) {
      if (lodash.isObject(runhooks[routine]) &&
          lodash.isObject(runhooks[routine][entity])) {
        return lodash.keys(runhooks[routine][entity]);
      }
    } else {
      if (lodash.isObject(runhooks[entity]) &&
          lodash.isObject(runhooks[entity][routine])) {
        return lodash.keys(runhooks[entity][routine]);
      }
    }
    return [];
  };

  self.isRunhookAvailable = function(runhook) {
    return lodash.isFunction(getRunhookOp(runhook));
  };

  self.execute = function(runhook, context) {
    return params.jobqueueMaster.enqueueJob(runhook, context);
  };

  self.callRunhook = function(runhook) {
    runhook = runhook || {};
    var routine = runhook.routine;
    var entity = runhook.entity || 'default';
    var operation = runhook.operation || 'default';
    var payload = runhook.payload || runhook.document || {};

    if (self.logger.isLevelEnabled('debug')) {
      self.logger.debug('<%s> * callRunhook("%s")', self.getSandboxName(), JSON.stringify(runhook));
    }

    var runhooks = self.getRunhooks();
    var runhookOp = getRunhookOp(runhook);
    if (lodash.isFunction(runhookOp)) {
      return Promise.resolve(useLoadingContext() ? runhookOp(payload) : runhookOp.call(runhookInstance, payload));
    } else {
      return Promise.reject(lodash.assign({ name: 'runhook_is_not_available' }, runhook));
    }
  };

  params.pluginLoader.loadRunhooks(runhookMap, useLoadingContext() ? runhookInstance : {});

  debugx.enabled && debugx(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "runhookManager",
  "type": "object",
  "properties": {
    "injectedServices": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "pluginLoader": {
      "type": "object"
    },
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
    "jobqueueMaster": {
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
