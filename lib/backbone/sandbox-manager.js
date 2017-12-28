'use strict';

var util = require('util');
var lodash = require('lodash');
var Promise = require('bluebird');
var Injektor = require('injektor');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debugx = require('../utils/pinbug.js')('devebot:sandboxManager');
var RunhookManager = require('./runhook-manager.js');
var errorHandler = require('./error-handler').instance;

var defaultServiceNames = [
  'jobqueue-master', 'jobqueue-worker'
];

var Service = function(params) {
  var self = this;
  params = params || {};

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  var managerMap = {};
  var serviceMap = {};
  var triggerMap = {};

  chores.loadServiceByNames(managerMap, __dirname, defaultServiceNames);

  params.pluginLoader.loadServices(serviceMap);
  params.pluginLoader.loadTriggers(triggerMap);

  var managerNames = lodash.keys(managerMap);
  serviceMap = lodash.omit(serviceMap, managerNames);
  triggerMap = lodash.omit(triggerMap, managerNames);

  var sandboxes = {};
  var dialectRefs = {};

  lodash.forOwn(params['sandboxList'], function(value, key) {
    var sandbox = {};

    debugx.enabled && debugx(' - load the sandbox[%s] with configuration: %s', key, util.inspect(value));
    debugx.enabled && debugx(' - create sandbox[%s].injektor object', key);

    sandbox.injektor = new Injektor({ separator: chores.getSeparator() });
    sandbox.injektor
      .registerObject('sandboxName', key, chores.injektorContext)
      .registerObject('sandboxConfig', value, chores.injektorContext)
      .registerObject('profileConfig', params['profileConfig'], chores.injektorContext)
      .registerObject('pluginLoader', params['pluginLoader'], chores.injektorContext)
      .registerObject('schemaValidator', params['schemaValidator'], chores.injektorContext)
      .registerObject('loggingFactory', params['loggingFactory'], chores.injektorContext);

    lodash.forOwn(managerMap, function(managerConstructor, managerName) {
      sandbox.injektor.defineService(managerName, managerConstructor, chores.injektorContext);
    });

    lodash.forOwn(serviceMap, function(serviceRecord, serviceName) {
      sandbox.injektor.defineService(serviceRecord.name, serviceRecord.construktor, {
        scope: serviceRecord.moduleId
      });
    });

    lodash.forOwn(triggerMap, function(triggerRecord, triggerName) {
      sandbox.injektor.defineService(triggerRecord.name, triggerRecord.construktor, {
        scope: triggerRecord.moduleId
      });
    });

    var dialectMap = params.bridgeLoader.loadDialects({}, lodash.get(value, ['bridges'], {}));

    lodash.forOwn(dialectMap, function(dialectRecord, dialectName) {
      sandbox.injektor.defineService(dialectRecord.name, dialectRecord.construktor, {
        scope: dialectRecord.moduleId
      });
    });

    var injectedHandlers = {};
    sandbox.injektor.registerObject('injectedHandlers', injectedHandlers, chores.injektorContext);

    sandbox.injektor.defineService('runhookManager', RunhookManager, chores.injektorContext);

    sandbox.injektor.registerObject('bridgeDialectNames', lodash.keys(dialectMap), chores.injektorContext);
    sandbox.injektor.registerObject('pluginServiceNames', lodash.keys(serviceMap), chores.injektorContext);
    sandbox.injektor.registerObject('pluginTriggerNames', lodash.keys(triggerMap), chores.injektorContext);

    sandboxes[key] = sandbox;
    dialectRefs[key] = dialectMap;
  });

  var instantiateObject = function(sandbox, handlerRecord, handlerType, injectedHandlers) {
    var exceptions = [];
    var handlerName = [handlerRecord.moduleId, handlerRecord.name].join(sandbox.injektor.separator);
    if (injectedHandlers) {
      injectedHandlers[handlerName] = sandbox.injektor.lookup(handlerName, exceptions);
    }
    lodash.forEach(exceptions, function(exception) {
      var opStatus = {
        stage: 'instantiating',
        type: handlerType,
        name: handlerName,
        hasError: true,
        stack: exception.stack
      };
      errorHandler.collect(opStatus);
    });
  }

  lodash.forOwn(sandboxes, function(sandbox, sandboxName) {
    var injectedHandlers = sandbox.injektor.lookup('injectedHandlers', chores.injektorContext);

    lodash.forOwn(serviceMap, function(serviceRecord, serviceName) {
      instantiateObject(sandbox, serviceRecord, 'SERVICE', injectedHandlers);
    });

    lodash.forOwn(triggerMap, function(triggerRecord, triggerName) {
      instantiateObject(sandbox, triggerRecord, 'TRIGGER');
    });

    lodash.forOwn(dialectRefs[sandboxName], function(dialectRecord, dialectName) {
      instantiateObject(sandbox, dialectRecord, 'DIALECT', injectedHandlers);
    });

    sandbox.injektor.lookup('runhookManager', chores.injektorContext);
    sandbox.injektor.lookup('jobqueueWorker', chores.injektorContext);
  });

  var devebotCfg = lodash.get(params, ['profileConfig', 'devebot'], {});
  errorHandler.barrier(devebotCfg);

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

  self.getSandboxService = function(serviceName, context) {
    return sandboxes[sandboxPointer].injektor.lookup(serviceName, context);
  };

  self.getBridgeDialectNames = function() {
    return sandboxes[sandboxPointer].injektor.lookup('bridgeDialectNames', chores.injektorContext);
  };

  self.getPluginServiceNames = function() {
    return sandboxes[sandboxPointer].injektor.lookup('pluginServiceNames', chores.injektorContext);
  };

  self.getPluginTriggerNames = function() {
    return sandboxes[sandboxPointer].injektor.lookup('pluginTriggerNames', chores.injektorContext);
  };

  self.startTriggers = function(sandboxNames, triggerNames) {
    debugx.enabled && debugx(' - Start triggers: ');
    return self.eachTriggers(function(trigger) {
      trigger.start();
    }, sandboxNames, triggerNames, 'start');
  };

  self.stopTriggers = function(sandboxNames, triggerNames) {
    debugx.enabled && debugx(' - Stop triggers: ');
    return self.eachTriggers(function(trigger) {
      trigger.stop();
    }, sandboxNames, triggerNames, 'stop');
  };

  self.eachTriggers = function(iteratee, sandboxNames, triggerNames, actionName) {
    if (!lodash.isFunction(iteratee)) return;

    if (lodash.isString(sandboxNames)) sandboxNames = [sandboxNames];
    if (sandboxNames && !lodash.isArray(sandboxNames)) return;
    debugx.enabled && debugx(' - Loop sandboxes: %s', JSON.stringify(sandboxNames || 'all'));

    if (lodash.isString(triggerNames)) triggerNames = [triggerNames];
    if (triggerNames && !lodash.isArray(triggerNames)) return;
    debugx.enabled && debugx(' - Loop triggers: %s', JSON.stringify(triggerNames || 'all'));

    var triggers = [];
    lodash.forOwn(sandboxes, function(sandbox, sandboxName) {
      if (!sandboxNames || sandboxNames.indexOf(sandboxName) >= 0) {
        lodash.forOwn(triggerMap, function(triggerRecord, triggerId) {
          var triggerName = [triggerRecord.moduleId, triggerRecord.name].join(sandbox.injektor.separator);
          if (!triggerNames || triggerNames.indexOf(triggerName) >= 0) {
            if (debugx.enabled) debugx(' - %s sandbox[%s][%s]', actionName, sandboxName, triggerName);
            var trigger = sandbox.injektor.lookup(triggerName);
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
        bridge_dialect_names: 'Bridge dialects',
        plugin_service_names: 'Plugin services',
        plugin_trigger_names: 'Plugin triggers'
      },
      data: {
        sandbox_pointer: self.getSandboxPointer(),
        sandbox_names: JSON.stringify(self.getSandboxNames(), null, 2),
        bridge_dialect_names: JSON.stringify(self.getBridgeDialectNames(), null, 2),
        plugin_service_names: JSON.stringify(self.getPluginServiceNames(), null, 2),
        plugin_trigger_names: JSON.stringify(self.getPluginTriggerNames(), null, 2)
      }
    });

    mergeSandboxServiceHelps.call(self, self.getBridgeDialectNames(), blocks);
    mergeSandboxServiceHelps.call(self, self.getPluginServiceNames(), blocks);
    mergeSandboxServiceHelps.call(self, self.getPluginTriggerNames(), blocks);

    return blocks;
  };

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
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
    "schemaValidator": {
      "type": "object"
    }
  }
};

module.exports = Service;

var getUniqueName = function(record, injektor) {
  return [record.moduleId, record.name].join(injektor.separator);
}

var wrapScriptConstructor = function(ScriptConstructor, wrapperNames) {
  function wrapperConstructor(params) {
    ScriptConstructor.call(this, params);
  }

  wrapperConstructor.prototype = Object.create(ScriptConstructor.prototype);

  wrapperConstructor.argumentSchema = lodash.cloneDeep(ScriptConstructor.argumentSchema);
  lodash.forEach(wrapperNames, function(serviceName) {
    var serviceEntry = {};
    serviceEntry[serviceName] = { "type": "object" };
    lodash.assign(wrapperConstructor.argumentSchema.properties, serviceEntry);
  });

  return wrapperConstructor;
};

var mergeSandboxServiceHelps = function(serviceNames, blocks) {
  var self = this;
  serviceNames.forEach(function(serviceName) {
    pickSandboxServiceHelp.call(self, serviceName, blocks);
  });
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
