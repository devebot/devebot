'use strict';

var util = require('util');
var lodash = require('lodash');
var Promise = require('bluebird');
var Injektor = require('injektor');
var chores = require('../utils/chores');
var constx = require('../utils/constx');
var RunhookManager = require('./runhook-manager');
var errorHandler = require('./error-handler').instance;

var defaultServiceNames = [ 'jobqueue-binder' ];

var Service = function(params) {
  var self = this;
  params = params || {};

  var blockRef = chores.getBlockRef(__filename);
  var loggingFactory = params.loggingFactory.branch(blockRef);
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
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
    sandboxConfig: util.inspect(sandboxConfig),
  }).toMessage({
    text: ' - load the sandbox${sandboxNames} with configuration: ${sandboxConfig}'
  }));

  LX.has('silly') && LX.log('silly', LT.add({
    sandboxNames: sandboxNames,
    sandboxConfig: sandboxConfig
  }).toMessage({
    tags: [ blockRef, 'sandbox-info' ],
    text: ' - create sandbox${sandboxNames}.injektor object'
  }));

  var sandboxInjektor = new Injektor(chores.injektorOptions);
  var COPIED_DEPENDENCIES = [ 'appName', 'appInfo',
    'sandboxNames', 'sandboxConfig', 'profileNames', 'profileConfig',
    'pluginLoader', 'schemaValidator', 'loggingFactory'
  ];
  COPIED_DEPENDENCIES.forEach(function(refName) {
    sandboxInjektor.registerObject(refName, params[refName], chores.injektorContext);
  });
  var REGISTRY_EXCLUDED_SERVICES = lodash.map([ 'pluginLoader' ], getComponentLabel);

  lodash.forOwn(managerMap, function(managerConstructor, managerName) {
    sandboxInjektor.defineService(managerName, managerConstructor, chores.injektorContext);
  });

  lodash.forOwn(serviceMap, function(serviceRecord, serviceName) {
    sandboxInjektor.defineService(serviceRecord.name, serviceRecord.construktor, {
      scope: serviceRecord.crateScope
    });
  });

  lodash.forOwn(triggerMap, function(triggerRecord, triggerName) {
    sandboxInjektor.defineService(triggerRecord.name, triggerRecord.construktor, {
      scope: triggerRecord.crateScope
    });
  });

  var dialectMap = params.bridgeLoader.loadDialects({}, lodash.get(sandboxConfig, ['bridges'], {}));

  lodash.forOwn(dialectMap, function(dialectRecord, dialectName) {
    sandboxInjektor.defineService(dialectRecord.name, dialectRecord.construktor, {
      scope: dialectRecord.crateScope
    });
  });

  sandboxInjektor.registerObject('sandboxRegistry', new SandboxRegistry({
    injektor: sandboxInjektor,
    excludedServices: REGISTRY_EXCLUDED_SERVICES
  }), chores.injektorContext);
  REGISTRY_EXCLUDED_SERVICES.push(getComponentLabel('sandboxRegistry'));

  sandboxInjektor.defineService('runhookManager', RunhookManager, chores.injektorContext);
  REGISTRY_EXCLUDED_SERVICES.push(getComponentLabel('runhookManager'));

  var injectedHandlers = {};
  var miscObjects = {
    injectedHandlers: injectedHandlers,
    bridgeDialectNames: lodash.keys(dialectMap),
    pluginServiceNames: lodash.keys(serviceMap),
    pluginTriggerNames:lodash.keys(triggerMap),
    sandboxName: params['sandboxNames'].join(','),
    profileName: params['profileNames'].join(',')
  }
  lodash.forOwn(miscObjects, function(obj, name) {
    sandboxInjektor.registerObject(name, obj, chores.injektorContext);
  });

  LX.has('silly') && LX.log('silly', LT.add({
    excludedServices: REGISTRY_EXCLUDED_SERVICES
  }).toMessage({
    tags: [ blockRef, 'excluded-internal-services' ],
    text: ' - REGISTRY_EXCLUDED_SERVICES: ${excludedServices}'
  }));

  var instantiateObject = function(_injektor, handlerRecord, handlerType, injectedHandlers) {
    var exceptions = [];
    var handlerName = [handlerRecord.crateScope, handlerRecord.name].join(_injektor.separator);
    LX.has('silly') && LX.log('silly', LT.add({
      handlerName: handlerName,
      handlerType: handlerType
    }).toMessage({
      tags: [ blockRef, 'instantiateObject' ],
      text: ' - instantiate object: ${handlerName}'
    }));
    var handler = _injektor.lookup(handlerName, exceptions);
    if (handler && injectedHandlers) {
      injectedHandlers[handlerName] = handler;
    }
    if (handler && handlerType === 'TRIGGER') {
      var methods = {
        start: (handler.start || handler.open),
        stop: (handler.stop || handler.close)
      }
      lodash.forOwn(methods, function(method, methodName) {
        if (!lodash.isFunction(method)) {
          errorHandler.collect({
            stage: 'instantiating',
            type: handlerType,
            name: handlerName,
            hasError: true,
            stack: util.format('Trigger[%s].%s() not found', handlerName, methodName)
          });
        }
      });
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

  lodash.forOwn(dialectMap, function(dialectRecord, dialectName) {
    instantiateObject(sandboxInjektor, dialectRecord, 'DIALECT', injectedHandlers);
  });

  lodash.forOwn(serviceMap, function(serviceRecord, serviceName) {
    instantiateObject(sandboxInjektor, serviceRecord, 'SERVICE', injectedHandlers);
  });

  lodash.forOwn(triggerMap, function(triggerRecord, triggerName) {
    instantiateObject(sandboxInjektor, triggerRecord, 'TRIGGER');
  });

  sandboxInjektor.lookup('injectedHandlers', chores.injektorContext);
  sandboxInjektor.lookup('runhookManager', chores.injektorContext);

  var devebotCfg = lodash.get(params, ['profileConfig', 'devebot'], {});
  errorHandler.barrier(lodash.assign({ invoker: blockRef }, devebotCfg));

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
    LX.has('silly') && LX.log('silly', LT.toMessage({
      tags: [ blockRef, 'trigger', 'start' ],
      text: ' - Start triggers'
    }));
    return self.eachTriggers(function(trigger) {
      return trigger.start();
    }, triggerNames, 'start');
  };

  self.stopTriggers = function(triggerNames) {
    LX.has('silly') && LX.log('silly', LT.toMessage({
      tags: [ blockRef, 'trigger', 'stop' ],
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
    LX.has('silly') && LX.log('silly', LT.add({
      triggerNames: triggerNames || 'all'
    }).toMessage({
      tags: [ blockRef, 'trigger', 'loop' ],
      text: ' - Loop triggers: ${triggerNames}'
    }));

    var triggers = [];
    lodash.forOwn(triggerMap, function(triggerRecord, triggerId) {
      var triggerName = [triggerRecord.crateScope, triggerRecord.name].join(sandboxInjektor.separator);
      if (!triggerNames || triggerNames.indexOf(triggerName) >= 0) {
        LX.has('silly') && LX.log('silly', LT.add({
          actionName: actionName,
          triggerName: triggerName
        }).toMessage({
          tags: [ blockRef, 'trigger', 'action' ],
          text: ' - ${actionName} trigger[${triggerName}]'
        }));
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

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.argumentSchema = {
  "$id": "sandboxManager",
  "type": "object",
  "properties": {
    "appName": {
      "type": "string"
    },
    "appInfo": {
      "type": "object"
    },
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

var getComponentLabel = function(compName) {
  return 'devebot' + chores.getSeparator() + compName;
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

var SandboxRegistry = function(params) {
  params = params || {};
  this.defineService = function(name, construktor, context) {
    context = context || {};
    var info = params.injektor.parseName(name, context);
    if (info.scope === 'devebot') {
      var RestrictedError = chores.buildError('RestrictedDevebotError');
      throw new RestrictedError('dependency scope [devebot] is restricted');
    }
    var exceptions = [];
    var fullname = params.injektor.resolveName(serviceName, {
      scope: context.scope,
      exceptions: exceptions
    });
    if (fullname != null) {
      var DuplicatedError = chores.buildError('DuplicatedDevebotError');
      throw new DuplicatedError('dependency item is duplicated');
    }
    params.injektor.defineService(name, construktor, context);
  };
  this.lookupService = function(serviceName, context) {
    context = context || {};
    var exceptions = [];
    var fullname = params.injektor.resolveName(serviceName, {
      scope: context.scope,
      exceptions: exceptions
    });
    if (fullname == null) return null;
    if (lodash.isFunction(params.isExcluded) && params.isExcluded(fullname)) return null;
    if (lodash.isArray(params.excludedServices) && 
        params.excludedServices.indexOf(fullname) >= 0) return null;
    return params.injektor.lookup(serviceName, context);
  }
};
