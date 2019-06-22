'use strict';

const util = require('util');
const lodash = require('lodash');
const Promise = require('bluebird');
const Injektor = require('injektor');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const errors = require('../utils/errors');
const nodash = require('../utils/nodash');
const RunhookManager = require('./runhook-manager');
const blockRef = chores.getBlockRef(__filename);

const DEFAULT_SERVICES = [ 'jobqueue-binder' ];

function SandboxManager(params = {}) {
  const issueInspector = params.issueInspector;
  const loggingFactory = params.loggingFactory.branch(blockRef);
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  const managerMap = {};
  chores.loadServiceByNames(managerMap, __dirname, DEFAULT_SERVICES);
  const managerNames = lodash.keys(managerMap);

  const serviceMap = {};
  params.bundleLoader.loadServices(serviceMap);
  chores.kickOutOf(serviceMap, managerNames);

  const triggerMap = {};
  params.bundleLoader.loadTriggers(triggerMap);
  chores.kickOutOf(triggerMap, managerNames);

  const sandboxNames = params.sandboxNames;
  const sandboxConfig = params.sandboxConfig;

  L.has('dunce') && L.log('dunce', T.add({
    sandboxNames: sandboxNames,
    sandboxConfig: util.inspect(sandboxConfig),
  }).toMessage({
    text: ' - load the sandbox${sandboxNames} with configuration: ${sandboxConfig}'
  }));

  L.has('silly') && L.log('silly', T.add({ sandboxNames, sandboxConfig }).toMessage({
    tags: [ blockRef, 'sandbox-info' ],
    text: ' - create sandbox${sandboxNames}.injektor object'
  }));

  const sandboxInjektor = new Injektor(chores.injektorOptions);
  const COPIED_DEPENDENCIES = [ 'appName', 'appInfo',
    'sandboxNames', 'sandboxConfig', 'profileNames', 'profileConfig',
    'contextManager', 'schemaValidator', 'loggingFactory', 'processManager'
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

  const dialectMap = params.bridgeLoader.loadDialects({}, lodash.get(sandboxConfig, ['bridges'], {}));

  lodash.forOwn(dialectMap, function(dialectRecord, dialectName) {
    sandboxInjektor.defineService(dialectRecord.name, dialectRecord.construktor, {
      scope: dialectRecord.crateScope
    });
  });

  const REGISTRY_EXCLUDED_SERVICES = [ getComponentLabel('sandboxRegistry') ];
  L.has('silly') && L.log('silly', T.add({
    excludedServices: REGISTRY_EXCLUDED_SERVICES
  }).toMessage({
    tags: [ blockRef, 'excluded-internal-services' ],
    text: ' - REGISTRY_EXCLUDED_SERVICES: ${excludedServices}'
  }));

  sandboxInjektor.registerObject('sandboxRegistry', new SandboxRegistry({
    injektor: sandboxInjektor,
    excludedServices: REGISTRY_EXCLUDED_SERVICES
  }), chores.injektorContext);

  function getCrateName(handlerRecord) {
    return [handlerRecord.crateScope, handlerRecord.name].join(sandboxInjektor.separator);
  }

  const injectedHandlers = {};
  const injectedServices = {};
  const sandboxName = params['sandboxNames'].join(',');
  const profileName = params['profileNames'].join(',');
  const miscObjects = {
    bridgeDialectNames: lodash.map(lodash.values(dialectMap), getCrateName),
    pluginServiceNames: lodash.map(lodash.values(serviceMap), getCrateName),
    pluginTriggerNames: lodash.map(lodash.values(triggerMap), getCrateName),
    sandboxName: sandboxName,
    profileName: profileName
  }
  lodash.forOwn(miscObjects, function(obj, name) {
    sandboxInjektor.registerObject(name, obj, chores.injektorContext);
  });

  const instantiateObject = function(_injektor, handlerRecord, handlerType, injectedHandlers, injectedServices) {
    const exceptions = [];
    const handlerName = [handlerRecord.crateScope, handlerRecord.name].join(_injektor.separator);
    L.has('silly') && L.log('silly', T.add({ handlerName, handlerType }).toMessage({
      tags: [ blockRef, 'instantiateObject' ],
      text: ' - instantiate object: ${handlerName}'
    }));
    const handler = _injektor.lookup(handlerName, exceptions);
    if (handler && injectedHandlers) {
      injectedHandlers[handlerName] = handler;
    }
    if (handler && injectedServices && handlerRecord.crateScope) {
      injectedServices[handlerRecord.crateScope] = injectedServices[handlerRecord.crateScope] || {};
      injectedServices[handlerRecord.crateScope][handlerName] = handler;
    }
    if (handler && handlerType === 'TRIGGER') {
      const methods = {
        start: (handler.start || handler.open),
        stop: (handler.stop || handler.close)
      }
      const requiredMethods = lodash.filter(lodash.keys(methods), function(name) {
        return !lodash.isFunction(methods[name]);
      });
      if (!lodash.isEmpty(requiredMethods)) {
        issueInspector.collect({
          stage: 'check-methods',
          type: handlerType,
          name: handlerName,
          hasError: true,
          methods: requiredMethods
        });
      }
    }
    lodash.forEach(exceptions, function(exception) {
      const opStatus = {
        stage: 'instantiating',
        type: handlerType,
        name: handlerName,
        hasError: true,
        stack: exception.stack
      };
      issueInspector.collect(opStatus);
    });
  }

  lodash.forOwn(dialectMap, function(dialectRecord, dialectName) {
    instantiateObject(sandboxInjektor, dialectRecord, 'DIALECT', injectedHandlers, injectedServices);
  });

  lodash.forOwn(serviceMap, function(serviceRecord, serviceName) {
    instantiateObject(sandboxInjektor, serviceRecord, 'SERVICE', injectedHandlers, injectedServices);
  });

  lodash.forOwn(triggerMap, function(triggerRecord, triggerName) {
    instantiateObject(sandboxInjektor, triggerRecord, 'TRIGGER', injectedServices);
  });

  const runhookInjektor = new Injektor(chores.injektorOptions);
  const RUNHOOK_DEPENDENCIES = [ 'bundleLoader' ].concat(COPIED_DEPENDENCIES);
  RUNHOOK_DEPENDENCIES.forEach(function(refName) {
    runhookInjektor.registerObject(refName, params[refName], chores.injektorContext);
  });
  runhookInjektor.registerObject('sandboxName', sandboxName, chores.injektorContext);
  runhookInjektor.registerObject('profileName', profileName, chores.injektorContext);
  runhookInjektor.registerObject('injectedHandlers', injectedHandlers, chores.injektorContext);
  runhookInjektor.registerObject('injectedServices', injectedServices, chores.injektorContext);

  lodash.forOwn(managerMap, function(managerConstructor, managerName) {
    runhookInjektor.defineService(managerName, managerConstructor, chores.injektorContext);
  });
  runhookInjektor.defineService('runhookManager', RunhookManager, chores.injektorContext);
  const runhookManager = runhookInjektor.lookup('runhookManager', chores.injektorContext);

  sandboxInjektor.registerObject('runhookManager', runhookManager, chores.injektorContext);

  this.getRunhookManager = function() {
    return runhookManager;
  }

  this.getSandboxService = function(serviceName, context) {
    return sandboxInjektor.lookup(serviceName, context);
  };

  this.getBridgeDialectNames = function() {
    return sandboxInjektor.lookup('bridgeDialectNames', chores.injektorContext);
  };

  this.getPluginServiceNames = function() {
    return sandboxInjektor.lookup('pluginServiceNames', chores.injektorContext);
  };

  this.getPluginTriggerNames = function() {
    return sandboxInjektor.lookup('pluginTriggerNames', chores.injektorContext);
  };

  this.startTriggers = function(triggerNames) {
    L.has('silly') && L.log('silly', T.toMessage({
      tags: [ blockRef, 'trigger', 'start' ],
      text: ' - Start triggers'
    }));
    return this.eachTriggers(function(trigger) {
      return trigger.start();
    }, triggerNames, { actionName: 'start' });
  };

  this.stopTriggers = function(triggerNames) {
    L.has('silly') && L.log('silly', T.toMessage({
      tags: [ blockRef, 'trigger', 'stop' ],
      text: ' - Stop triggers'
    }));
    return this.eachTriggers(function(trigger) {
      return trigger.stop();
    }, triggerNames, { actionName: 'stop' });
  };

  this.eachTriggers = function(iteratee, triggerNames, options) {
    if (!lodash.isFunction(iteratee)) return;
    if (lodash.isString(triggerNames)) triggerNames = [triggerNames];
    if (triggerNames && !lodash.isArray(triggerNames)) return;
    L.has('silly') && L.log('silly', T.add({ triggerNames: triggerNames || 'all' }).toMessage({
      tags: [ blockRef, 'trigger', 'loop' ],
      text: ' - Loop triggers: ${triggerNames}'
    }));
    const actionName = options && options.actionName;
    const triggers = [];
    lodash.forOwn(triggerMap, function(triggerRecord, triggerId) {
      const triggerName = getCrateName(triggerRecord);
      if (!triggerNames || triggerNames.indexOf(triggerName) >= 0) {
        L.has('silly') && L.log('silly', T.add({ actionName, triggerName }).toMessage({
          tags: [ blockRef, 'trigger', 'action' ],
          text: ' - ${actionName} trigger[${triggerName}]'
        }));
        const trigger = sandboxInjektor.lookup(triggerName);
        if (trigger) {
          triggers.push(trigger);
        }
      }
    });
    return Promise.mapSeries(triggers, iteratee);
  };

  this.getServiceInfo = function() {
    return {};
  };

  this.getServiceHelp = function() {
    const self = this;
    const blocks = [];

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

  L.has('silly') && L.log('silly', T.toMessage({
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
    "bundleLoader": {
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
    "contextManager": {
      "type": "object"
    },
    "issueInspector": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "processManager": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    }
  }
};

module.exports = SandboxManager;

function getComponentLabel(compName) {
  return constx.FRAMEWORK.NAME + chores.getSeparator() + compName;
}

function wrapScriptConstructor(ScriptConstructor, wrapperNames) {
  function wrapperConstructor(params) {
    ScriptConstructor.call(this, params);
  }

  wrapperConstructor.prototype = Object.create(ScriptConstructor.prototype);

  wrapperConstructor.argumentSchema = lodash.cloneDeep(ScriptConstructor.argumentSchema);
  lodash.forEach(wrapperNames, function(serviceName) {
    const serviceEntry = {};
    serviceEntry[serviceName] = { "type": "object" };
    lodash.assign(wrapperConstructor.argumentSchema.properties, serviceEntry);
  });

  return wrapperConstructor;
};

function mergeSandboxServiceHelps(serviceNames, blocks) {
  const self = this;
  serviceNames.forEach(function(serviceName) {
    pickSandboxServiceHelp.call(self, serviceName, blocks);
  });
};

function pickSandboxServiceHelp(serviceName, blocks) {
  const self = this;
  const serviceObject = self.getSandboxService(serviceName);
  if (lodash.isObject(serviceObject) && lodash.isFunction(serviceObject.getServiceHelp)) {
    const serviceHelp = nodash.arrayify(serviceObject.getServiceHelp());
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

function SandboxRegistry(params = {}) {
  const {injektor, isExcluded, excludedServices} = params;
  function validateBeanName(beanName, context = {}) {
    const info = injektor.parseName(beanName, context);
    if (info.scope === constx.FRAMEWORK.NAME) {
      const RestrictedError = errors.assertConstructor('RestrictedDevebotError');
      throw new RestrictedError(util.format('dependency scope [%s] is restricted', constx.FRAMEWORK.NAME));
    }
    const exceptions = [];
    const fullname = injektor.resolveName(beanName, {
      scope: context.scope,
      exceptions: exceptions
    });
    if (fullname != null) {
      const DuplicatedError = errors.assertConstructor('DuplicatedDevebotError');
      throw new DuplicatedError('dependency item is duplicated');
    }
  }
  this.declareObject = function(beanName, beanObject, context) {
    validateBeanName(beanName, context);
    injektor.registerObject(beanName, beanObject, context);
  };
  this.defineService = function(beanName, construktor, context) {
    validateBeanName(beanName, context);
    injektor.defineService(beanName, construktor, context);
  };
  this.lookup = function(serviceName, context) {
    context = context || {};
    const exceptions = [];
    const fullname = injektor.resolveName(serviceName, {
      scope: context.scope,
      exceptions: exceptions
    });
    if (fullname == null) return null;
    if (lodash.isFunction(isExcluded) && isExcluded(fullname)) return null;
    if (lodash.isArray(excludedServices) && excludedServices.indexOf(fullname) >= 0) return null;
    return injektor.lookup(serviceName, context);
  }
  // @deprecated
  this.lookupService = this.lookup;
};
