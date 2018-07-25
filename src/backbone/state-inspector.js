'use strict';

const assert = require('assert');
const lodash = require('lodash');
const Chalk = require('../utils/chalk');
const chores = require('../utils/chores');
const envbox = require('../utils/envbox');
const toolset = require('../utils/toolset');
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

  let options = {};
  let services = {};
  let stateMap = {};

  function getOptions() {
    options.mode = options.mode || filterTask(envbox.getEnv('TASKS'));
    return options;
  }

  this.init = function(opts) {
    if (opts && opts.tasks) {
      let tasks = lodash.isArray(opts.tasks) ? opts.tasks : envbox.stringToArray(opts.tasks);
      options.mode = filterTask(tasks);
    }
    return lodash.clone(options.mode);
  }

  this.register = function(bean) {
    let options = getOptions();
    if (isEnabled(options)) {
      lodash.assign(services, bean);
    }
    return this;
  }

  this.collect = function(info) {
    let options = getOptions();
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
    if (chores.isUpgradeSupported(['presets', 'bridge-full-ref', 'standardizing-config'])) {
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
    let options = getOptions();
    if (isEnabled(options)) {
      let label = getModeLabel(options);
      try {
        if (hasTask(options, 'list-env-vars')) {
          envbox.printEnvList();
        }
        if (hasTask(options, 'list-all-env-vars')) {
          envbox.printEnvList({ excludes: [] });
        }
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
    Object.keys(services).forEach(function(key) {
      delete services[key];
    });
    Object.keys(stateMap).forEach(function(key) {
      delete stateMap[key];
    });
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

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ color chalks

let chalk = new Chalk({
  themes: {
    heading1: ['cyan', 'bold'],
    heading2: 'cyan',
    configType: 'underline',
    configBody: 'grey',
    configModule: 'underline',
    configIsNull: ['red', 'bold'],
    configIsEmpty: ['yellow', 'bold'],
    configIsOk: ['green', 'bold'],
    configDefault: ['grey'],
    configMixture: ['green']
  }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

let modeMap = {
  'list-env-vars': null,
  'list-all-env-vars': null,
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
  console.log(chalk.heading1('[+] Display final configuration content:'));
  lodash.forEach(['profile', 'sandbox'], function(cfgType) {
    let cfgObj = lodash.get(stateMap, ['config', cfgType, 'mixture'], null);
    console.log(chalk.heading2('[-] Final %s configuration:'), chalk.configType(cfgType));
    console.log(chalk.configBody(JSON_stringify(cfgObj)));
  });
}

let printSummary = function(summary) {
  console.log(chalk.heading1('[+] %s configuration checking result:'), chalk.configModule('Plugin'));
  let pluginInfos = lodash.get(summary, ['config', 'sandbox', 'plugins'], {});
  lodash.forOwn(pluginInfos, function(info, name) {
    switch (info.status) {
      case -1:
      console.log('--> %s(%s) (Undefined/default):', chalk.configIsNull(info.code), chalk.configIsNull(name));
      console.log(chalk.configDefault(JSON_stringify(info.mixture)));
      break;

      case 0:
      console.log('--> %s(%s) (Empty/default):', chalk.configIsEmpty(info.code), chalk.configIsEmpty(name));
      console.log(chalk.configDefault(JSON_stringify(info.mixture)));
      break;

      case 1:
      console.log('--> %s(%s) (Ok/customized):', chalk.configIsOk(info.code), chalk.configIsOk(name));
      console.log(chalk.configMixture(JSON_stringify(info.mixture)));
      break;
    }
  });

  console.log(chalk.heading1('[+] %s configuration checking result:'), chalk.configModule('Bridge'));
  let bridgeInfos = lodash.get(summary, ['config', 'sandbox', 'bridges'], {});
  lodash.forOwn(bridgeInfos, function(info, name) {
    switch (info.status) {
      case -1:
      console.log('--> %s (Undefined/default):', chalk.configIsNull(name));
      console.log(chalk.configDefault(JSON_stringify(info.mixture)));
      break;

      case 0:
      console.log('--> %s (Empty/default):', chalk.configIsEmpty(name));
      console.log(chalk.configDefault(JSON_stringify(info.mixture)));
      break;

      case 1:
      console.log('--> %s (Ok/customized):', chalk.configIsOk(name));
      console.log(chalk.configMixture(JSON_stringify(info.mixture)));
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

let JSON_stringify = function(jsObj) {
  if (toolset.has('traverse')) {
    let traverse = toolset.get('traverse');
    jsObj = traverse(jsObj).forEach(function (x) {
      if (lodash.isFunction(x)) {
        this.update('[Function]');
      }
    });
  }
  return JSON.stringify(jsObj, null, 2);
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ default instance

let stateInspector;

Object.defineProperty(StateInspector, 'instance', {
  get: function() {
    return (stateInspector = stateInspector || new StateInspector());
  },
  set: function(value) {}
});
