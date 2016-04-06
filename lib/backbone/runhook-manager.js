'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var lodash = require('lodash');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debuglog = require('../utils/debug.js')('devebot:runhookManager');

/**
 * The constructor for RunhookManager class.
 * 
 * @constructor
 * @param {Object} params - The parameters of the constructor.
 * @param {Object} params.runhook - The parameters that sent to Runhooks
 */
var Service = function(params) {
  debuglog(' + constructor start ...');
  Service.super_.apply(this);
  
  params = params || {};
  
  var self = this;
  
  self.logger = params.loggingFactory.getLogger();
  
  self.runhookInstance = {
    sandboxname: params.sandboxname,
    sandboxconfig: params.sandboxconfig,
    service: {
      loggingFactory: params.loggingFactory
    }
  };
  
  lodash.forEach(params.injectedServices, function(serviceName) {
    self.runhookInstance.service[serviceName] = params[serviceName];
  });

  self.getSandboxName = function() {
    return params.sandboxname;
  };

  if (debuglog.isEnabled) {
    debuglog(' - create a runhook-manager instance in <%s>', self.getSandboxName());
  }

  var runhookRoot = {};

  self.getRunhooks = function() {
    return (runhookRoot[constx.RUNHOOK.ROOT_KEY] || {});
  };

  self.isContextPassedAtLoading = function() {
    return lodash.get(params, ['generalconfig', constx.RUNHOOK.ROOT_KEY, 'context_passed_at_loading']) == true;
  };

  self.isRunhookPathAsc = function() {
    return true;
  };

  params.pluginLoader.loadRunhooks(runhookRoot, self.isContextPassedAtLoading() ? self.runhookInstance : {});

  debuglog(' - constructor has finished');
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
    "sandboxname": {
      "type": "string"
    },
    "sandboxconfig": {
      "type": "object"
    },
    "profileconfig": {
      "type": "object"
    },
    "generalconfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

Service.prototype.getRunhookEntities = function(routine) {
  var self = this;
  var runhooks = self.getRunhooks();
  
  var modelsByRoutine = [];
  if (self.isRunhookPathAsc()) {
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

Service.prototype.getRunhookOperations = function(routine, entity) {
  var self = this;
  var runhooks = self.getRunhooks();
  if (self.isRunhookPathAsc()) {
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

Service.prototype.isRunhookAvailable = function(routine, entity, operation) {
  var self = this;
  var runhooks = self.getRunhooks();
  if (self.isRunhookPathAsc()) {
    return (lodash.isObject(runhooks[routine]) &&
        lodash.isObject(runhooks[routine][entity]) &&
        lodash.isFunction(runhooks[routine][entity][operation]));
  } else {
    return (lodash.isObject(runhooks[entity]) &&
        lodash.isObject(runhooks[entity][routine]) &&
        lodash.isFunction(runhooks[entity][routine][operation]));
  }
};

Service.prototype.callRunhook = function(routine, entity, operation, document) {
  var self = this;
  var runhooks = self.getRunhooks();
  self.logger.debug('<%s> * callRunhook("%s", "%s", "%s")', self.getSandboxName(), routine, entity, operation);
  if (self.isRunhookAvailable(routine, entity, operation)) {
    var runhookOp = self.isRunhookPathAsc() ? runhooks[routine][entity][operation] : runhooks[entity][routine][operation];
    return Promise.resolve(self.isContextPassedAtLoading() ? runhookOp(document) : runhookOp.call(self.runhookInstance, document));
  } else {
    return Promise.reject({ name: 'runhook_is_not_available', routine: routine, entity: entity, operation: operation});
  }
};

Service.prototype.getServiceInfo = function() {
  return {};
};

Service.prototype.getServiceHelp = function() {
  return [];
};

module.exports = Service;
