'use strict';

const util = require('util');
const lodash = require('lodash');
const Promise = require('bluebird');
const Injektor = require('injektor');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const RunhookManager = require('./runhook-manager');
const errorHandler = require('./error-handler').instance;
const blockRef = chores.getBlockRef(__filename);

const DEFAULT_SERVICES = [ 'jobqueue-binder' ];

function SandboxManager(params) {
  params = params || {};

  let self = this;
  let loggingFactory = params.loggingFactory.branch(blockRef);
  let LX = loggingFactory.getLogger();
  let LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let managerMap = {};
  let serviceMap = {};
  let triggerMap = {};

  chores.loadServiceByNames(managerMap, __dirname, DEFAULT_SERVICES);

  params.pluginLoader.loadServices(serviceMap);
  params.pluginLoader.loadTriggers(triggerMap);

  let managerNames = lodash.keys(managerMap);
  serviceMap = lodash.omit(serviceMap, managerNames);
  triggerMap = lodash.omit(triggerMap, managerNames);

  let sandboxNames = params.sandboxNames;
  let sandboxConfig = params.sandboxConfig;

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

  let sandboxInjektor = new Injektor(chores.injektorOptions);
  let COPIED_DEPENDENCIES = [ 'appName', 'appInfo',
    'sandboxNames', 'sandboxConfig', 'profileNames', 'profileConfig',
    'schemaValidator', 'loggingFactory'
  ];
  COPIED_DEPENDENCIES.forEach(function(refName) {
    sandboxInjektor.registerObject(refName, params[refName], chores.injektorContext);
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

  let dialectMap = params.bridgeLoader.loadDialects({}, lodash.get(sandboxConfig, ['bridges'], {}));

  lodash.forOwn(dialectMap, function(dialectRecord, dialectName) {
    sandboxInjektor.defineService(dialectRecord.name, dialectRecord.construktor, {
      scope: dialectRecord.crateScope
    });
  });

  let REGISTRY_EXCLUDED_SERVICES = [ getComponentLabel('sandboxRegistry') ];
  sandboxInjektor.registerObject('sandboxRegistry', new SandboxRegistry({
    injektor: sandboxInjektor,
    excludedServices: REGISTRY_EXCLUDED_SERVICES
  }), chores.injektorContext);

  let injectedHandlers = {};
  let sandboxName = params['sandboxNames'].join(',');
  let profileName = params['profileNames'].join(',');
  let miscObjects = {
    bridgeDialectNames: lodash.keys(dialectMap),
    pluginServiceNames: lodash.keys(serviceMap),
    pluginTriggerNames:lodash.keys(triggerMap),
    sandboxName: sandboxName,
    profileName: profileName
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

  let instantiateObject = function(_injektor, handlerRecord, handlerType, injectedHandlers) {
    let exceptions = [];
    let handlerName = [handlerRecord.crateScope, handlerRecord.name].join(_injektor.separator);
    LX.has('silly') && LX.log('silly', LT.add({ handlerName, handlerType }).toMessage({
      tags: [ blockRef, 'instantiateObject' ],
      text: ' - instantiate object: ${handlerName}'
    }));
    let handler = _injektor.lookup(handlerName, exceptions);
    if (handler && injectedHandlers) {
      injectedHandlers[handlerName] = handler;
    }
    if (handler && handlerType === 'TRIGGER') {
      let methods = {
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
      let opStatus = {
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

  let runhookInjektor = new Injektor(chores.injektorOptions);
  let RUNHOOK_DEPENDENCIES = [ 'pluginLoader' ].concat(COPIED_DEPENDENCIES);
  RUNHOOK_DEPENDENCIES.forEach(function(refName) {
    runhookInjektor.registerObject(refName, params[refName], chores.injektorContext);
  });
  runhookInjektor.registerObject('sandboxName', sandboxName, chores.injektorContext);
  runhookInjektor.registerObject('profileName', profileName, chores.injektorContext);
  runhookInjektor.registerObject('injectedHandlers', injectedHandlers, chores.injektorContext);

  lodash.forOwn(managerMap, function(managerConstructor, managerName) {
    runhookInjektor.defineService(managerName, managerConstructor, chores.injektorContext);
  });
  runhookInjektor.defineService('runhookManager', RunhookManager, chores.injektorContext);

  runhookInjektor.lookup('runhookManager', chores.injektorContext);

  self.getRunhookManager = function() {
    return runhookInjektor.lookup('runhookManager', chores.injektorContext);
  }

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

    let triggers = [];
    lodash.forOwn(triggerMap, function(triggerRecord, triggerId) {
      let triggerName = [triggerRecord.crateScope, triggerRecord.name].join(sandboxInjektor.separator);
      if (!triggerNames || triggerNames.indexOf(triggerName) >= 0) {
        LX.has('silly') && LX.log('silly', LT.add({ actionName, triggerName }).toMessage({
          tags: [ blockRef, 'trigger', 'action' ],
          text: ' - ${actionName} trigger[${triggerName}]'
        }));
        let trigger = sandboxInjektor.lookup(triggerName);
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
    let blocks = [];

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

SandboxManager.argumentSchema = {
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

module.exports = SandboxManager;

let getComponentLabel = function(compName) {
  return 'devebot' + chores.getSeparator() + compName;
}

let wrapScriptConstructor = function(ScriptConstructor, wrapperNames) {
  function wrapperConstructor(params) {
    ScriptConstructor.call(this, params);
  }

  wrapperConstructor.prototype = Object.create(ScriptConstructor.prototype);

  wrapperConstructor.argumentSchema = lodash.cloneDeep(ScriptConstructor.argumentSchema);
  lodash.forEach(wrapperNames, function(serviceName) {
    let serviceEntry = {};
    serviceEntry[serviceName] = { "type": "object" };
    lodash.assign(wrapperConstructor.argumentSchema.properties, serviceEntry);
  });

  return wrapperConstructor;
};

let mergeSandboxServiceHelps = function(serviceNames, blocks) {
  let self = this;
  serviceNames.forEach(function(serviceName) {
    pickSandboxServiceHelp.call(self, serviceName, blocks);
  });
};

let pickSandboxServiceHelp = function(serviceName, blocks) {
  let self = this;
  let serviceObject = self.getSandboxService(serviceName);
  if (lodash.isObject(serviceObject) && lodash.isFunction(serviceObject.getServiceHelp)) {
    let serviceHelp = serviceObject.getServiceHelp();
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

let SandboxRegistry = function(params) {
  params = params || {};
  this.defineService = function(name, construktor, context) {
    context = context || {};
    let info = params.injektor.parseName(name, context);
    if (info.scope === 'devebot') {
      let RestrictedError = chores.buildError('RestrictedDevebotError');
      throw new RestrictedError('dependency scope [devebot] is restricted');
    }
    let exceptions = [];
    let fullname = params.injektor.resolveName(serviceName, {
      scope: context.scope,
      exceptions: exceptions
    });
    if (fullname != null) {
      let DuplicatedError = chores.buildError('DuplicatedDevebotError');
      throw new DuplicatedError('dependency item is duplicated');
    }
    params.injektor.defineService(name, construktor, context);
  };
  this.lookupService = function(serviceName, context) {
    context = context || {};
    let exceptions = [];
    let fullname = params.injektor.resolveName(serviceName, {
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
