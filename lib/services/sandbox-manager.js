'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');

var Injektor = require('injektor');

var ContextManager = require('../services/context-manager.js');
var ServiceManager = require('../services/service-manager.js');
var JobqueueAdapter = require('../services/jobqueue-adapter.js');
var JobqueueWorker = require('../services/jobqueue-worker.js');
var RunhookManager = require('../services/runhook-manager.js');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var logger = require('logdapter').defaultLogger;

var Service = function(params) {
  Service.super_.call(this);
  
  params = params || {};
  
  var self = this;
  
  var moduleFolders = params.moduleFolders || [];

  var serviceMap = {};
  var triggerMap = {};

  moduleFolders.forEach(function(folder) {
    chores.loadServiceEntries.call(self, serviceMap, folder + constx.SERVICE.SCRIPT_DIR);
    chores.loadServiceEntries.call(self, triggerMap, folder + constx.TRIGGER.SCRIPT_DIR);
  });

  lodash.forOwn(serviceMap, function(serviceConstructor, serviceName) {
    var serviceEntry = {};
    serviceEntry[serviceName] = { "type": "object" };
    lodash.assign(RunhookManager.argumentSchema.properties, serviceEntry);
    RunhookManager.injectedServices.push(serviceName);
  });

  var sandboxes = {};
  
  var contexts = params['sandboxList'] || {};
  lodash.forOwn(contexts, function(value, key) {
    var sandbox = {};

    logger.debug(' + load the context[%s] with configuration %s', key, JSON.stringify(value));

    logger.trace(' + create sandbox[%s].injektor object', key);
    sandbox.injektor = new Injektor();
    sandbox.injektor
      .registerObject('sandboxname', key)
      .registerObject('sandboxconfig', value)
      .registerObject('generalconfig', params['generalconfig'])
      .registerObject('profileconfig', params['profileconfig'])
      .registerObject('moduleFolders', params['moduleFolders'])
      .registerObject('loggingFactory', params['loggingFactory'])
      .defineService('contextManager', ContextManager)
      .defineService('serviceManager', ServiceManager)
      .defineService('jobqueueAdapter', JobqueueAdapter)
      .defineService('jobqueueWorker', JobqueueWorker)
      .defineService('runhookManager', RunhookManager);

    lodash.forOwn(serviceMap, function(serviceConstructor, serviceName) {
      sandbox.injektor.defineService(serviceName, serviceConstructor);
    });

    lodash.forOwn(triggerMap, function(triggerConstructor, triggerName) {
      sandbox.injektor.defineService(triggerName, triggerConstructor);
    });

    sandboxes[key] = sandbox;
  });
  
  self.getSandboxNames = function() {
    return lodash.keys(sandboxes);
  };
  
  self.isSandboxAvailable = function(sandboxName) {
    return lodash.isObject(sandboxes[sandboxName]);
  };
  
  var sandboxPointer = lodash.keys(sandboxes)[0];
  
  self.getSandboxPointer = function() {
    return sandboxPointer;
  };
  
  self.setSandboxPointer = function(sandboxName) {
    sandboxPointer = sandboxName;
  };
  
  self.getSandboxService = function(serviceName) {
    return sandboxes[sandboxPointer].injektor.lookup(serviceName);
  };
  
  self.startTriggers = function(sandboxNames, triggerNames) {
    logger.trace(' - Start triggers: ');
    self.eachTriggers(function(trigger) {
      trigger.start();
    }, sandboxNames, triggerNames);
  };
  
  self.stopTriggers = function(sandboxNames, triggerNames) {
    logger.trace(' - Stop triggers: ');
    self.eachTriggers(function(trigger) {
      trigger.stop();
    }, sandboxNames, triggerNames);
  };

  self.eachTriggers = function(iteratee, sandboxNames, triggerNames) {
    if (!lodash.isFunction(iteratee)) return;

    if (lodash.isString(sandboxNames)) sandboxNames = [sandboxNames];
    if (sandboxNames && !lodash.isArray(sandboxNames)) return;
    logger.trace(' - Loop sandboxes: %s', JSON.stringify(sandboxNames || 'all'));

    if (lodash.isString(triggerNames)) triggerNames = [triggerNames];
    if (triggerNames && !lodash.isArray(triggerNames)) return;
    logger.trace(' - Loop triggers: %s', JSON.stringify(triggerNames || 'all'));

    lodash.forOwn(sandboxes, function(sandboxInstance, sandboxName) {
      if (!sandboxNames || sandboxNames.indexOf(sandboxName) >= 0) {
        lodash.forOwn(triggerMap, function(triggerClass, triggerName) {
          if (!triggerNames || triggerNames.indexOf(triggerName) >= 0) {
            logger.trace(' - run sandbox[%s][%s]', sandboxName, triggerName);
            iteratee(sandboxes[sandboxName].injektor.lookup(triggerName));
          }
        });
      }
    });
  };
};

Service.argumentSchema = {
  "id": "/sandboxManager",
  "type": "object",
  "properties": {
    "moduleFolders": {
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
    "sandboxList": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
