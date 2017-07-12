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

  var log = self.logger = params.loggingFactory.getLogger();

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  debugx.enabled && debugx(' - create a runhook-manager instance in <%s>', self.getSandboxName());

  var runhookInstance = {
    sandboxName: params.sandboxName,
    sandboxConfig: params.sandboxConfig,
    service: {
      loggingFactory: params.loggingFactory
    }
  };

  debugx.enabled && debugx(' - injectedServices: %s', JSON.stringify(params.injectedServices));
  lodash.forEach(params.injectedServices, function(serviceName) {
    runhookInstance.service[serviceName] = params[serviceName];
  });

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
    if (self.logger.isLevelEnabled('trace')) {
      self.logger.trace('runhookManager on sandbox[%s] - runhook: %s - enqueue',
        self.getSandboxName(), JSON.stringify(runhook));
    }
    if (runhook.mode !== 'rpc' || params.jobqueueMaster.enabled === false) {
      return self.process(runhook).then(function(result) {
        result._alreadyWrittenToOutlet = false;
        return Promise.resolve(result);
      }).catch(function(error) {
        error._alreadyWrittenToOutlet = false;
        return Promise.reject(error);
      });
    } else {
      return params.jobqueueMaster.enqueueJob(runhook, context);
    }
  };

  self.process = function(runhook) {
    runhook = runhook || {};

    if (self.logger.isLevelEnabled('trace')) {
      self.logger.trace('runhookManager on sandbox[%s] - runhook: %s - process',
        self.getSandboxName(), JSON.stringify(runhook));
    }

    var runhooks = self.getRunhooks();
    var runhookOp = runhooks[runhook.name].handler;
    var payload = runhook.data;
    if (lodash.isFunction(runhookOp)) {
      if (predefinedContext) {
        return Promise.resolve(runhookOp(payload));
      } else {
        return Promise.resolve(runhookOp.call(runhookInstance, payload));
      }
    } else {
      return Promise.reject(lodash.assign({ reason: 'invalid_runhook_op' }, runhook));
    }
  };

  params.pluginLoader.loadRunhooks(runhookMap, predefinedContext ? runhookInstance : {});

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
