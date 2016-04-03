'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');

var Injektor = require('injektor');

var RunhookManager = require('./runhook-manager.js');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debug = require('../utils/debug.js');
var debuglog = debug('devebot:sandboxManager');

var defaultServiceNames = [
  'context-manager', 'service-manager', 'jobqueue-master', 'jobqueue-worker', 'system-executor'
];

var Service = function(params) {
  debuglog(' + constructor start ...');
  Service.super_.apply(this);
  
  params = params || {};
  
  var self = this;
  
  var managerMap = {};
  var serviceMap = {};
  var triggerMap = {};

  chores.loadServiceByNames(managerMap, __dirname, defaultServiceNames);

  params.pluginLoader.loadServices(serviceMap);
  params.pluginLoader.loadTriggers(triggerMap);

  var managerNames = lodash.keys(managerMap);
  serviceMap = lodash.omit(serviceMap, managerNames);
  triggerMap = lodash.omit(triggerMap, managerNames);

  var injectedServices = [];
  lodash.forOwn(serviceMap, function(serviceConstructor, serviceName) {
    var serviceEntry = {};
    serviceEntry[serviceName] = { "type": "object" };
    lodash.assign(RunhookManager.argumentSchema.properties, serviceEntry);
    injectedServices.push(serviceName);
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
      .registerObject('pluginLoader', params['pluginLoader'])
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

    var wrapperMap = params.bridgeLoader.loadWrappers({}, lodash.get(value, ['bridges'], {}));

    lodash.forOwn(wrapperMap, function(wrapperConstructor, wrapperName) {
      sandbox.injektor.defineService(wrapperName, wrapperConstructor);
    });

    var sandboxServices = [].concat(lodash.cloneDeep(injectedServices), lodash.keys(wrapperMap));
    sandbox.injektor.registerObject('injectedServices', sandboxServices);

    var sandboxRunhookManager = wrapRunhookManager(lodash.keys(wrapperMap));
    sandbox.injektor.defineService('runhookManager', sandboxRunhookManager);

    sandbox.injektor.registerObject('bridgeWrapperNames', lodash.keys(wrapperMap));
    sandbox.injektor.registerObject('pluginServiceNames', lodash.keys(serviceMap));
    sandbox.injektor.registerObject('pluginTriggerNames', lodash.keys(triggerMap));

    sandboxes[key] = sandbox;
  });
  
  lodash.forOwn(sandboxes, function(sandboxInstance, sandboxName) {
    lodash.forOwn(serviceMap, function(serviceConstructor, serviceName) {
      sandboxes[sandboxName].injektor.lookup(serviceName);
    });

    lodash.forOwn(triggerMap, function(triggerConstructor, triggerName) {
      sandboxes[sandboxName].injektor.lookup(triggerName);
    });
    
    sandboxes[sandboxName].injektor.lookup('runhookManager');
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

  self.getBridgeWrapperNames = function() {
    return sandboxes[sandboxPointer].injektor.lookup('bridgeWrapperNames');
  };

  self.getPluginServiceNames = function() {
    return sandboxes[sandboxPointer].injektor.lookup('pluginServiceNames');
  };

  self.getPluginTriggerNames = function() {
    return sandboxes[sandboxPointer].injektor.lookup('pluginTriggerNames');
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
    var blocks = [];
    
    blocks.push({
      type: 'record',
      title: 'Sandbox overview',
      label: {
        sandbox_pointer: 'Current sanbox',
        sandbox_names: 'List of sandboxes',
        bridge_wrapper_names: 'Bridge wrappers',
        plugin_service_names: 'Plugin services',
        plugin_trigger_names: 'Plugin triggers'
      },
      data: {
        sandbox_pointer: self.getSandboxPointer(),
        sandbox_names: JSON.stringify(self.getSandboxNames(), null, 2),
        bridge_wrapper_names: JSON.stringify(self.getBridgeWrapperNames(), null, 2),
        plugin_service_names: JSON.stringify(self.getPluginServiceNames(), null, 2),
        plugin_trigger_names: JSON.stringify(self.getPluginTriggerNames(), null, 2)
      }
    });

    mergeSandboxServiceHelps.call(self, self.getBridgeWrapperNames(), blocks);
    mergeSandboxServiceHelps.call(self, self.getPluginServiceNames(), blocks);
    mergeSandboxServiceHelps.call(self, self.getPluginTriggerNames(), blocks);

    return blocks;
  };
  
  debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "/sandboxManager",
  "type": "object",
  "properties": {
    "bridgeLoader": {
      "type": "object"
    },
    "pluginLoader": {
      "type": "object"
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

var wrapRunhookManager = function(wrapperNames) {
  function wrapperConstructor(params) {
    RunhookManager.call(this, params);
  }

  wrapperConstructor.prototype = Object.create(RunhookManager.prototype);

  wrapperConstructor.argumentSchema = lodash.cloneDeep(RunhookManager.argumentSchema);
  lodash.forEach(wrapperNames, function(serviceName) {
    var serviceEntry = {};
    serviceEntry[serviceName] = { "type": "object" };
    lodash.assign(wrapperConstructor.argumentSchema.properties, serviceEntry);
  });

  return wrapperConstructor;
};

var mergeSandboxServiceHelps = function(serviceNames, blocks) {
  debuglog(' + retrieves and merges the list of serviceHelps');
  
  var self = this;
  serviceNames.forEach(function(serviceName) {
    pickSandboxServiceHelp.call(self, serviceName, blocks);
  });

  debuglog(' - merging serviceHelps has done!');
};

var pickSandboxServiceHelp = function(serviceName, blocks) {
  var self = this;
  var serviceObject = self.getSandboxService(serviceName);
  if (lodash.isObject(serviceObject) && lodash.isFunction(serviceObject.getServiceHelp)) {
    var serviceHelp = serviceObject.getServiceHelp();
    if (lodash.isObject(serviceHelp) && !lodash.isArray(serviceHelp)) {
      serviceHelp = [serviceHelp];
    }
    if (lodash.isArray(serviceHelp)) {
      lodash.forEach(serviceHelp, function(serviceInfo) {
        if (lodash.isString(serviceInfo.title)) {
          serviceInfo.title = serviceName + ' - ' + serviceInfo.title;
        }
        blocks.push(serviceInfo);
      });
    }
  }
};
