'use strict';

const assert = require('assert');
const lodash = require('lodash');
const Chalk = require('../utils/chalk');
const chores = require('../utils/chores');
const envbox = require('../utils/envbox');
const nodash = require('../utils/nodash');
const toolset = require('../utils/toolset');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

function StateInspector(params={}) {
  const loggingWrapper = new LoggingWrapper(blockRef);
  const L = loggingWrapper.getLogger();
  const T = loggingWrapper.getTracer();

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  const options = {};
  const services = {};
  const stateMap = {};

  function getOptions() {
    options.mode = options.mode || filterTask(envbox.getEnv('TASKS'));
    return options;
  }

  this.init = function(opts) {
    if (opts && opts.tasks) {
      const taskList = lodash.isArray(opts.tasks) ? opts.tasks : nodash.stringToArray(opts.tasks);
      options.mode = filterTask(taskList);
    }
    return lodash.clone(options.mode);
  }

  this.register = function(bean) {
    if (isEnabled(getOptions())) {
      lodash.assign(services, bean);
    }
    return this;
  }

  this.collect = function(info) {
    if (isEnabled(getOptions())) {
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
    assert(lodash.isArray(services.bridgeList));
    assert(lodash.isArray(services.pluginList));

    // extract bridge names
    const bridgeNames = lodash.map(services.bridgeList, 'name');
    L.has('debug') && L.log('debug', T.add({bridgeNames}).toMessage({
      tags: [ blockRef, 'examine', 'bridge-names'],
      text: ' - bridge names: ${bridgeNames}'
    }));

    // extract plugin names
    const pluginList = lodash.filter(services.pluginList, function(pluginRef) {
      return pluginRef.type === 'plugin';
    });
    const pluginNames = lodash.map(pluginList, 'name');
    L.has('debug') && L.log('debug', T.add({pluginNames}).toMessage({
      tags: [ blockRef, 'examine', 'plugin-names'],
      text: ' - plugin names: ${pluginNames}'
    }));

    const summary = { config: { sandbox: { plugins: {}, bridges: {} } } };

    // examines configuration of plugins
    const pluginMixture = lodash.get(stateMap, 'config.sandbox.mixture.plugins', {});
    const pluginExpanse = lodash.get(stateMap, 'config.sandbox.expanse.plugins', {});
    lodash.forEach(pluginNames, function(name) {
      const codeInCamel = services.nameResolver.getDefaultAliasOf(name, 'plugin');
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
    const bridgeMixtureInDeep = lodash.get(stateMap, 'config.sandbox.mixture.bridges', {});
    const bridgeExpanseInDeep = lodash.get(stateMap, 'config.sandbox.expanse.bridges', {});
    if (chores.isUpgradeSupported(['presets', 'bridge-full-ref', 'standardizing-config'])) {
      const bridgeMixture = flattenBridgeConfig(bridgeMixtureInDeep);
      const bridgeExpanse = flattenBridgeConfig(bridgeExpanseInDeep);
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
    const options = getOptions();
    if (isEnabled(options)) {
      const label = getModeLabel(options);
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

  L.has('silly') && L.log('silly', T.toMessage({
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

const chalk = new Chalk({
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

const TASK_MAP = {
  'list-env-vars': null,
  'list-all-env-vars': null,
  'print-config': null,
  'check-config': null
};

envbox.setAcceptedValues("TASKS", lodash.keys(TASK_MAP));

function getModeLabel(options) {
  return JSON.stringify(options.mode);
}

function isEnabled(options) {
  return options && lodash.isArray(options.mode) && !lodash.isEmpty(options.mode);
}

function filterTask(tasks) {
  if (lodash.isArray(tasks)) {
    return lodash.filter(tasks, function(task) {
      return task in TASK_MAP;
    })
  }
  return [];
}

function hasTask(options, taskName) {
  return options && lodash.isArray(options.mode) && options.mode.indexOf(taskName) >= 0;
}

function printContent(stateMap) {
  console.log(chalk.heading1('[+] Display final configuration content:'));
  lodash.forEach(['profile', 'sandbox'], function(cfgType) {
    const cfgObj = lodash.get(stateMap, ['config', cfgType, 'mixture'], null);
    console.log(chalk.heading2('[-] Final %s configuration:'), chalk.configType(cfgType));
    console.log(chalk.configBody(JSON_stringify(cfgObj)));
  });
}

function printSummary(summary) {
  console.log(chalk.heading1('[+] %s configuration checking result:'), chalk.configModule('Plugin'));
  const pluginInfos = lodash.get(summary, ['config', 'sandbox', 'plugins'], {});
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
  const bridgeInfos = lodash.get(summary, ['config', 'sandbox', 'bridges'], {});
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

function flattenBridgeConfig(bridgeConfig, flatBridgeCfgs) {
  flatBridgeCfgs = flatBridgeCfgs || {};
  lodash.forOwn(bridgeConfig, function(bridgeInfo, bridgeName) {
    lodash.forOwn(bridgeInfo, function(pluginInfo, pluginName) {
      lodash.forOwn(pluginInfo, function(dialectInfo, dialectName) {
        const fullname = [pluginName, chores.getSeparator(), bridgeName, '#', dialectName].join('');
        flatBridgeCfgs[fullname] = dialectInfo;
      });
    });
  });
  return flatBridgeCfgs;
}

function JSON_stringify(jsObj) {
  if (toolset.has('traverse')) {
    const traverse = toolset.get('traverse');
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
