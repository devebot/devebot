'use strict';

var util = require('util');
var lodash = require('lodash');
var Promise = require('bluebird');
var Injektor = require('injektor');

var RunhookManager = require('./runhook-manager.js');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debug = require('../utils/debug.js');
var debugx = debug('devebot:sandboxManager');
var errorHandler = require('./error-handler').instance;

var defaultServiceNames = [
  'jobqueue-factory', 'jobqueue-master', 'jobqueue-worker'
];

var Service = function(params) {
  debugx.enabled && debugx(' + constructor start ...');

  params = params || {};

  var self = this;

  var managerMap = {};
  var serviceMap = {};
  var triggerMap = {};

  params.contextMonitor.init();

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

  lodash.forOwn(params['sandboxList'], function(value, key) {
    var sandbox = {};

    debugx.enabled && debugx(' - load the sandbox[%s] with configuration: %s', key, util.inspect(value));
    debugx.enabled && debugx(' - create sandbox[%s].injektor object', key);

    sandbox.injektor = new Injektor();
    sandbox.injektor
      .registerObject('sandboxName', key)
      .registerObject('sandboxConfig', value)
      .registerObject('profileConfig', params['profileConfig'])
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

  var summary = params.contextMonitor.examine();

  var devebotCfg = lodash.get(params, ['profileConfig', 'devebot'], {});
  if (summary.numberOfErrors > 0) {
    debugx.enabled && debugx(' - %s constructor(s) has been load failed', summary.numberOfErrors);
    if (devebotCfg && devebotCfg.verbose !== false || debugx.enabled) {
      console.log('[x] Failed to load %s constructor(s):', summary.numberOfErrors);
      lodash.forEach(summary.failedServices, function(fsv) {
        switch(fsv.type) {
          case 'COMMAND':
          case 'RUNHOOK':
          case 'SERVICE':
          case 'TRIGGER':
          console.log(' -  [%s:%s] - %s in (%s%s)', fsv.type, fsv.name, fsv.file, fsv.pathDir, fsv.subDir);
          break;
          case 'WRAPPER':
          console.log(' -  [%s:%s->%s] in (%s)', fsv.type, fsv.name, fsv.code, fsv.path);
          break;
          default:
          console.log(' -  %s', JSON.stringify(fsv));
        }
      });
    }
    if (devebotCfg.exitOnError !== false) {
      console.log('[x] The program will exit now.');
      console.log('[x] Please fix the issues and then retry again.');
      errorHandler.exit(1);
    }
  }

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
    debugx.enabled && debugx(' - Start triggers: ');
    return self.eachTriggers(function(trigger) {
      trigger.start();
    }, sandboxNames, triggerNames);
  };

  self.stopTriggers = function(sandboxNames, triggerNames) {
    debugx.enabled && debugx(' - Stop triggers: ');
    return self.eachTriggers(function(trigger) {
      trigger.stop();
    }, sandboxNames, triggerNames);
  };

  self.eachTriggers = function(iteratee, sandboxNames, triggerNames) {
    if (!lodash.isFunction(iteratee)) return;

    if (lodash.isString(sandboxNames)) sandboxNames = [sandboxNames];
    if (sandboxNames && !lodash.isArray(sandboxNames)) return;
    debugx.enabled && debugx(' - Loop sandboxes: %s', JSON.stringify(sandboxNames || 'all'));

    if (lodash.isString(triggerNames)) triggerNames = [triggerNames];
    if (triggerNames && !lodash.isArray(triggerNames)) return;
    debugx.enabled && debugx(' - Loop triggers: %s', JSON.stringify(triggerNames || 'all'));

    var triggers = [];
    lodash.forOwn(sandboxes, function(sandboxInstance, sandboxName) {
      if (!sandboxNames || sandboxNames.indexOf(sandboxName) >= 0) {
        lodash.forOwn(triggerMap, function(triggerClass, triggerName) {
          if (!triggerNames || triggerNames.indexOf(triggerName) >= 0) {
            if (debugx.enabled) debugx(' - run sandbox[%s][%s]', sandboxName, triggerName);
            var trigger = sandboxes[sandboxName].injektor.lookup(triggerName);
            if (trigger) {
              triggers.push(trigger);
            }
          }
        });
      }
    });

    return Promise.mapSeries(triggers, function(trigger) {
      return iteratee(trigger);
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

  debugx.enabled && debugx(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "sandboxManager",
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
    "profileConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "contextMonitor": {
      "type": "object"
    }
  }
};

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
  debugx.enabled && debugx(' + retrieves and merges the list of serviceHelps');

  var self = this;
  serviceNames.forEach(function(serviceName) {
    pickSandboxServiceHelp.call(self, serviceName, blocks);
  });

  debugx.enabled && debugx(' - merging serviceHelps has done!');
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
