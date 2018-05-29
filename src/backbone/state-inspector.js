'use strict';

const assert = require('assert');
const lodash = require('lodash');
const chores = require('../utils/chores');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

function StateInspector(params) {
  params = params || {};

  let self = this;
  let loggingWrapper = new LoggingWrapper(blockRef);
  let LX = loggingWrapper.getLogger();
  let LT = loggingWrapper.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let options = {
    mode: filterTask(chores.stringToArray(process.env.DEVEBOT_VERIFICATION_MODE))
  };
  let services = {};
  let stateMap = {};

  this.init = function(opts) {
    if (opts && opts.tasks) {
      let tasks = lodash.isArray(opts.tasks) ? opts.tasks : chores.stringToArray(opts.tasks);
      options.mode = filterTask(tasks);
    }
    return this.reset();
  }

  this.register = function(bean) {
    if (isEnabled(options)) {
      lodash.assign(services, bean);
    }
    return this;
  }

  this.collect = function(info) {
    if (isEnabled(options)) {
      if (info instanceof Array) {
        lodash.assign.apply(lodash, lodash.concat([stateMap], info));
      } else {
        if (info && typeof info === 'object') {
          lodash.assign(stateMap, info);
        }
      }
    }
    return this;
  }

  this.examine = function(opts) {
    assert(lodash.isObject(services.nameResolver));
    assert(lodash.isArray(services.pluginRefs));
    assert(lodash.isArray(services.bridgeRefs));

    // extract plugin names, bridge names
    let pluginNames = lodash.map(services.pluginRefs, 'name');
    LX.has('debug') && LX.log('debug', LT.add({pluginNames}).toMessage({
      tags: [ blockRef, 'examine', 'plugin-names'],
      text: ' - plugin names: ${pluginNames}'
    }));

    let bridgeNames = lodash.map(services.bridgeRefs, 'name');
    LX.has('debug') && LX.log('debug', LT.add({bridgeNames}).toMessage({
      tags: [ blockRef, 'examine', 'bridge-names'],
      text: ' - bridge names: ${bridgeNames}'
    }));

    let summary = { config: { sandbox: { plugins: {}, bridges: {} } } };

    // examines configuration of plugins
    let pluginMixture = lodash.get(stateMap, 'config.sandbox.mixture.plugins', {});
    let pluginExpanse = lodash.get(stateMap, 'config.sandbox.expanse.plugins', {});
    lodash.forEach(pluginNames, function(name) {
      let codeInCamel = services.nameResolver.getDefaultAliasOf(name, 'plugin');
      if (codeInCamel in pluginExpanse) {
        if (lodash.isEmpty(pluginExpanse[codeInCamel])) {
          lodash.set(summary, ['config', 'sandbox', 'plugins', name], {
            code: codeInCamel,
            status: 0,
            expanse: pluginExpanse[codeInCamel],
            mixture: pluginMixture[codeInCamel]
          })
        } else {
          lodash.set(summary, ['config', 'sandbox', 'plugins', name], {
            code: codeInCamel,
            status: 1,
            expanse: pluginExpanse[codeInCamel],
            mixture: pluginMixture[codeInCamel]
          })
        }
      } else {
        lodash.set(summary, ['config', 'sandbox', 'plugins', name], {
          code: codeInCamel,
          status: -1,
          expanse: null,
          mixture: pluginMixture[codeInCamel]
        })
      }
    });

    // examine configuration of bridges
    let bridgeMixtureInDeep = lodash.get(stateMap, 'config.sandbox.mixture.bridges', {});
    let bridgeExpanseInDeep = lodash.get(stateMap, 'config.sandbox.expanse.bridges', {});
    if (chores.isFeatureSupported(['presets', 'bridge-full-ref', 'standardizing-config'])) {
      let bridgeMixture = flattenBridgeConfig(bridgeMixtureInDeep);
      let bridgeExpanse = flattenBridgeConfig(bridgeExpanseInDeep);
      lodash.forOwn(bridgeMixture, function(bridgeInfo, bridgeName) {
        if (bridgeName in bridgeExpanse) {
          if (lodash.isEmpty(bridgeExpanse[bridgeName])) {
            lodash.set(summary, ['config', 'sandbox', 'bridges', bridgeName], {
              status: 0,
              expanse: bridgeExpanse[bridgeName],
              mixture: bridgeMixture[bridgeName]
            })
          } else {
            lodash.set(summary, ['config', 'sandbox', 'bridges', bridgeName], {
              status: 1,
              expanse: bridgeExpanse[bridgeName],
              mixture: bridgeMixture[bridgeName]
            })
          }
        } else {
          lodash.set(summary, ['config', 'sandbox', 'bridges', bridgeName], {
            status: -1,
            expanse: null,
            mixture: bridgeMixture[bridgeName]
          })
        }
      });
    }

    return summary;
  }

  this.conclude = function(opts) {
    if (isEnabled(options)) {
      let label = getModeLabel(options);
      try {
        if (hasTask(options, 'check-config')) {
          printSummary(this.examine(opts));
        }
        if (hasTask(options, 'print-config')) {
          printContent(stateMap);
        }
      } catch(err) {
        console.error('Task %s has failed. Exception:\n%s', label, err.stack);
      } finally {
        console.log('Task %s has finished. application loading end.', label);
        process.exit(0);
      }
    }
    return this;
  }

  this.reset = function() {
    if (isEnabled(options)) {
      stateMap.splice(0, stateMap.length);
    }
    return this;
  }

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

StateInspector.argumentSchema = {
  "$id": "stateInspector",
  "type": "object",
  "properties": {}
};

module.exports = StateInspector;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

let modeMap = {
  'print-config': null,
  'check-config': null
};

let getModeLabel = function(options) {
  return JSON.stringify(options.mode);
}

let isEnabled = function(options) {
  return options && lodash.isArray(options.mode) && !lodash.isEmpty(options.mode);
}

let filterTask = function(tasks) {
  if (lodash.isArray(tasks)) {
    return lodash.filter(tasks, function(task) {
      return task in modeMap;
    })
  }
  return [];
}

let hasTask = function(options, taskName) {
  return options && lodash.isArray(options.mode) && options.mode.indexOf(taskName) >= 0;
}

let printContent = function(stateMap) {
  console.log('[+] Display final configuration content:');
  lodash.forEach(['profile', 'sandbox'], function(cfgType) {
    let cfgObj = lodash.get(stateMap, ['config', cfgType, 'mixture'], null);
    console.log('[-] Final %s configuration:\n%s', cfgType, JSON.stringify(cfgObj, null, 2));
  });
}

let printSummary = function(summary) {
  console.log('[+] Plugin configuration checking result:');
  let pluginInfos = lodash.get(summary, ['config', 'sandbox', 'plugins'], {});
  lodash.forOwn(pluginInfos, function(info, name) {
    switch (info.status) {
      case -1:
      console.log('--> NULL: config of plugin [%s](%s) in application is undefined, use DEFAULT:\n%s',
          info.code, name, JSON.stringify(info.mixture, null, 2));
      break;

      case 0:
      console.log('--> EMPTY: config of plugin [%s](%s) in application is empty, use DEFAULT:\n%s',
          info.code, name, JSON.stringify(info.mixture, null, 2));
      break;

      case 1:
      console.log('--> OK: config of plugin [%s](%s) in application is defined, use MIXTURE:\n%s',
          info.code, name, JSON.stringify(info.mixture, null, 2));
      break;
    }
  });

  console.log('[+] Bridge configuration checking result:');
  let bridgeInfos = lodash.get(summary, ['config', 'sandbox', 'bridges'], {});
  lodash.forOwn(bridgeInfos, function(info, name) {
    switch (info.status) {
      case -1:
      console.log('--> NULL: confirmed configure of dialect [%s] is undefined, use DEFAULT:\n%s',
          name, JSON.stringify(info.mixture, null, 2));
      break;

      case 0:
      console.log('--> EMPTY: confirmed configure of dialect [%s] is empty, use DEFAULT:\n%s',
          name, JSON.stringify(info.mixture, null, 2));
      break;

      case 1:
      console.log('--> OK: confirmed configure of dialect [%s] is determined, use MIXTURE:\n%s',
          name, JSON.stringify(info.mixture, null, 2));
      break;
    }
  });
}

let flattenBridgeConfig = function(bridgeConfig, flatBridgeCfgs) {
  flatBridgeCfgs = flatBridgeCfgs || {};
  lodash.forOwn(bridgeConfig, function(bridgeInfo, bridgeName) {
    lodash.forOwn(bridgeInfo, function(pluginInfo, pluginName) {
      lodash.forOwn(pluginInfo, function(dialectInfo, dialectName) {
        let fullname = [pluginName, '/', bridgeName, '#', dialectName].join('');
        flatBridgeCfgs[fullname] = dialectInfo;
      });
    });
  });
  return flatBridgeCfgs;
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ default instance

let stateInspector;

Object.defineProperty(StateInspector, 'instance', {
  get: function() {
    return (stateInspector = stateInspector || new StateInspector());
  },
  set: function(value) {}
});
