'use strict';

var util = require('util');
var lodash = require('lodash');
var Promise = require('bluebird');
var Injektor = require('injektor');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var RunhookManager = require('./runhook-manager.js');
var errorHandler = require('./error-handler').instance;

var defaultServiceNames = [ 'jobqueue-binder' ];

var Service = function(params) {
  var self = this;
  params = params || {};

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
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

  var sandboxNames = params.sandboxNames;
  var sandboxConfig = params.sandboxConfig;

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxNames: sandboxNames,
    sandboxCfg: util.inspect(sandboxConfig),
  }).toMessage({
    text: ' - load the sandbox[{sandboxNames}] with configuration: {sandboxCfg}'
  }));

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxNames: sandboxNames
  }).toMessage({
    text: ' - create sandbox[{sandboxNames}].injektor object'
  }));

  var sandboxInjektor = new Injektor({ separator: chores.getSeparator() });
  sandboxInjektor
    .registerObject('sandboxName', params['sandboxNames'].join(','), chores.injektorContext)
    .registerObject('sandboxNames', params['sandboxNames'], chores.injektorContext)
    .registerObject('sandboxConfig', params['sandboxConfig'], chores.injektorContext)
    .registerObject('profileName', params['profileNames'].join(','), chores.injektorContext)
    .registerObject('profileNames', params['profileNames'], chores.injektorContext)
    .registerObject('profileConfig', params['profileConfig'], chores.injektorContext)
    .registerObject('pluginLoader', params['pluginLoader'], chores.injektorContext)
    .registerObject('schemaValidator', params['schemaValidator'], chores.injektorContext)
    .registerObject('loggingFactory', params['loggingFactory'], chores.injektorContext);

  lodash.forOwn(managerMap, function(managerConstructor, managerName) {
    sandboxInjektor.defineService(managerName, managerConstructor, chores.injektorContext);
  });

  lodash.forOwn(serviceMap, function(serviceRecord, serviceName) {
    sandboxInjektor.defineService(serviceRecord.name, serviceRecord.construktor, {
      scope: serviceRecord.moduleId
    });
  });

  lodash.forOwn(triggerMap, function(triggerRecord, triggerName) {
    sandboxInjektor.defineService(triggerRecord.name, triggerRecord.construktor, {
      scope: triggerRecord.moduleId
    });
  });

  var dialectMap = params.bridgeLoader.loadDialects({}, lodash.get(sandboxConfig, ['bridges'], {}));

  lodash.forOwn(dialectMap, function(dialectRecord, dialectName) {
    sandboxInjektor.defineService(dialectRecord.name, dialectRecord.construktor, {
      scope: dialectRecord.moduleId
    });
  });

  sandboxInjektor.defineService('runhookManager', RunhookManager, chores.injektorContext);

  var injectedHandlers = {};
  sandboxInjektor.registerObject('injectedHandlers', injectedHandlers, chores.injektorContext);
  sandboxInjektor.registerObject('bridgeDialectNames', lodash.keys(dialectMap), chores.injektorContext);
  sandboxInjektor.registerObject('pluginServiceNames', lodash.keys(serviceMap), chores.injektorContext);
  sandboxInjektor.registerObject('pluginTriggerNames', lodash.keys(triggerMap), chores.injektorContext);

  var instantiateObject = function(_injektor, handlerRecord, handlerType, injectedHandlers) {
    var exceptions = [];
    var handlerName = [handlerRecord.moduleId, handlerRecord.name].join(_injektor.separator);
    if (injectedHandlers) {
      injectedHandlers[handlerName] = _injektor.lookup(handlerName, exceptions);
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

  var _injectedHandlers = sandboxInjektor.lookup('injectedHandlers', chores.injektorContext);

  lodash.forOwn(serviceMap, function(serviceRecord, serviceName) {
    instantiateObject(sandboxInjektor, serviceRecord, 'SERVICE', _injectedHandlers);
  });

  lodash.forOwn(triggerMap, function(triggerRecord, triggerName) {
    instantiateObject(sandboxInjektor, triggerRecord, 'TRIGGER');
  });

  lodash.forOwn(dialectMap, function(dialectRecord, dialectName) {
    instantiateObject(sandboxInjektor, dialectRecord, 'DIALECT', _injectedHandlers);
  });

  sandboxInjektor.lookup('runhookManager', chores.injektorContext);

  var devebotCfg = lodash.get(params, ['profileConfig', 'devebot'], {});
  errorHandler.barrier(devebotCfg);

  self.getSandboxNames = function() {
    return sandboxNames;
  };

  self.getSandboxService = function(serviceName, context) {
    return sandboxInjektor.lookup(serviceName, context);
  };

  self.getBridgeDialectNames = function() {
    return sandboxInjektor.lookup('bridgeDialectNames', chores.injektorContext);
  };

  self.getPluginServiceNames = function() {
    return sandboxInjektor.lookup('pluginServiceNames', chores.injektorContext);
  };

  self.getPluginTriggerNames = function() {
    return sandboxInjektor.lookup('pluginTriggerNames', chores.injektorContext);
  };

  self.startTriggers = function(triggerNames) {
    LX.has('conlog') && LX.log('conlog', LT.toMessage({
      tags: [ 'sandbox-triggers-start' ],
      text: ' - Start triggers'
    }));
    return self.eachTriggers(function(trigger) {
      return trigger.start();
    }, triggerNames, 'start');
  };

  self.stopTriggers = function(triggerNames) {
    LX.has('conlog') && LX.log('conlog', LT.toMessage({
      tags: [ 'sandbox-triggers-stop' ],
      text: ' - Stop triggers'
    }));
    return self.eachTriggers(function(trigger) {
      return trigger.stop();
    }, triggerNames, 'stop');
  };

  self.eachTriggers = function(iteratee, triggerNames, actionName) {
    if (!lodash.isFunction(iteratee)) return;

    if (lodash.isString(triggerNames)) triggerNames = [triggerNames];
    if (triggerNames && !lodash.isArray(triggerNames)) return;
    LX.has('conlog') && LX.log('conlog', ' - Loop triggers: %s', JSON.stringify(triggerNames || 'all'));

    var triggers = [];
    lodash.forOwn(triggerMap, function(triggerRecord, triggerId) {
      var triggerName = [triggerRecord.moduleId, triggerRecord.name].join(sandboxInjektor.separator);
      if (!triggerNames || triggerNames.indexOf(triggerName) >= 0) {
        LX.has('conlog') && LX.log('conlog', ' - %s trigger[%s]', actionName, triggerName);
        var trigger = sandboxInjektor.lookup(triggerName);
        if (trigger) {
          triggers.push(trigger);
        }
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
        sandbox_names: 'List of sandboxes',
        bridge_dialect_names: 'Bridge dialects',
        plugin_service_names: 'Plugin services',
        plugin_trigger_names: 'Plugin triggers'
      },
      data: {
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

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
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
    "sandboxNames": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileNames": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
