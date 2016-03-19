'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');

var Injektor = require('injektor');

var bridgeLoader = require('./bridge-loader.js');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debuglog = require('../utils/debug.js')('devebot:sandboxManager');

var defaultServiceNames = [
  'context-manager', 'service-manager', 'jobqueue-master', 'jobqueue-worker', 'runhook-manager'
];

var Service = function(params) {
  debuglog(' + constructor start ...');
  Service.super_.apply(this);
  
  params = params || {};
  
  var self = this;
  
  var moduleFolders = params.moduleFolders || [];

  var managerMap = {};
  var serviceMap = {};
  var triggerMap = {};

  chores.loadServiceByNames(managerMap, __dirname, defaultServiceNames);

  lodash.assign(serviceMap, bridgeLoader(params.bridgeNames));
  
  moduleFolders.forEach(function(folder) {
    chores.loadServiceEntries.call(self, serviceMap, folder + constx.SERVICE.SCRIPT_DIR);
    chores.loadServiceEntries.call(self, triggerMap, folder + constx.TRIGGER.SCRIPT_DIR);
  });

  var managerNames = lodash.keys(managerMap);
  serviceMap = lodash.omit(serviceMap, managerNames);
  triggerMap = lodash.omit(triggerMap, managerNames);

  lodash.forOwn(serviceMap, function(serviceConstructor, serviceName) {
    var RunhookManager = managerMap.runhookManager;
    var serviceEntry = {};
    serviceEntry[serviceName] = { "type": "object" };
    lodash.assign(RunhookManager.argumentSchema.properties, serviceEntry);
    RunhookManager.injectedServices.push(serviceName);
  });

  var sandboxes = {};
  
  var contexts = params['sandboxList'] || {};
  lodash.forOwn(contexts, function(value, key) {
    var sandbox = {};

    if (debuglog.isEnabled) {
      debuglog(' - load the context[%s] with configuration: %s', key, util.inspect(value));
    }
    
    if (debuglog.isEnabled) {
      debuglog(' - create sandbox[%s].injektor object', key);
    }
    
    sandbox.injektor = new Injektor();
    sandbox.injektor
      .registerObject('sandboxname', key)
      .registerObject('sandboxconfig', value)
      .registerObject('generalconfig', params['generalconfig'])
      .registerObject('profileconfig', params['profileconfig'])
      .registerObject('moduleFolders', params['moduleFolders'])
      .registerObject('loggingFactory', params['loggingFactory']);

    lodash.forOwn(managerMap, function(managerConstructor, managerName) {
      sandbox.injektor.defineService(managerName, managerConstructor);
    });

    lodash.forOwn(serviceMap, function(serviceConstructor, serviceName) {
      sandbox.injektor.defineService(serviceName, serviceConstructor);
    });

    lodash.forOwn(triggerMap, function(triggerConstructor, triggerName) {
      sandbox.injektor.defineService(triggerName, triggerConstructor);
    });

    sandboxes[key] = sandbox;
  });
  
  lodash.forOwn(sandboxes, function(sandboxInstance, sandboxName) {
    lodash.forOwn(serviceMap, function(serviceConstructor, serviceName) {
      sandboxes[sandboxName].injektor.lookup(serviceName);
    });

    lodash.forOwn(triggerMap, function(triggerConstructor, triggerName) {
      sandboxes[sandboxName].injektor.lookup(triggerName);
    });
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
    debuglog(' - Start triggers: ');
    self.eachTriggers(function(trigger) {
      trigger.start();
    }, sandboxNames, triggerNames);
  };
  
  self.stopTriggers = function(sandboxNames, triggerNames) {
    debuglog(' - Stop triggers: ');
    self.eachTriggers(function(trigger) {
      trigger.stop();
    }, sandboxNames, triggerNames);
  };

  self.eachTriggers = function(iteratee, sandboxNames, triggerNames) {
    if (!lodash.isFunction(iteratee)) return;

    if (lodash.isString(sandboxNames)) sandboxNames = [sandboxNames];
    if (sandboxNames && !lodash.isArray(sandboxNames)) return;
    if (debuglog.isEnabled) {
      debuglog(' - Loop sandboxes: %s', JSON.stringify(sandboxNames || 'all'));
    }

    if (lodash.isString(triggerNames)) triggerNames = [triggerNames];
    if (triggerNames && !lodash.isArray(triggerNames)) return;
    if (debuglog.isEnabled) {
      debuglog(' - Loop triggers: %s', JSON.stringify(triggerNames || 'all'));
    }

    lodash.forOwn(sandboxes, function(sandboxInstance, sandboxName) {
      if (!sandboxNames || sandboxNames.indexOf(sandboxName) >= 0) {
        lodash.forOwn(triggerMap, function(triggerClass, triggerName) {
          if (!triggerNames || triggerNames.indexOf(triggerName) >= 0) {
            if (debuglog.isEnabled) debuglog(' - run sandbox[%s][%s]', sandboxName, triggerName);
            iteratee(sandboxes[sandboxName].injektor.lookup(triggerName));
          }
        });
      }
    });
  };
  
  self.getServiceInfo = function() {
    return {};
  };
  
  self.getServiceHelp = function() {
    return [];
  };
  
  debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "/sandboxManager",
  "type": "object",
  "properties": {
    "bridgeNames": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "moduleFolders": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "sandboxList": {
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

module.exports = Service;
