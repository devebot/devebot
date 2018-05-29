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
    let sandboxMiddleConfig = lodash.get(stateMap, 'config.sandbox.partial', {});
    LX.has('silly') && LX.log('silly', LT.add({sandboxMiddleConfig}).toMessage({
      text: ' - sandbox middle config: ${sandboxMiddleConfig}'
    }));
    let pluginMixture = lodash.get(stateMap, 'config.sandbox.mixture.plugins', {});
    let pluginSupplement = sandboxMiddleConfig.plugins;
    if (pluginSupplement) {
      lodash.forEach(pluginNames, function(name) {
        let codeInCamel = services.nameResolver.getDefaultAliasOf(name, 'plugin');
        if (codeInCamel in pluginSupplement) {
          if (lodash.isEmpty(pluginSupplement[codeInCamel])) {
            lodash.set(summary, ['config', 'sandbox', 'plugins', name], {
              code: codeInCamel,
              status: 0,
              body: pluginSupplement[codeInCamel],
              final: pluginMixture[codeInCamel]
            })
          } else {
            lodash.set(summary, ['config', 'sandbox', 'plugins', name], {
              code: codeInCamel,
              status: 1,
              body: pluginSupplement[codeInCamel],
              final: pluginMixture[codeInCamel]
            })
          }
        } else {
          lodash.set(summary, ['config', 'sandbox', 'plugins', name], {
            code: codeInCamel,
            status: -1,
            body: null,
            final: pluginMixture[codeInCamel]
          })
        } 
      });
    }

    return summary;
  }

  this.conclude = function(opts) {
    if (isEnabled(options)) {
      let label = getModeLabel(options);
      if (hasTask(options, 'check-config')) {
        printSummary(this.examine(opts));
      }
      if (hasTask(options, 'print-config')) {
        printContent(stateMap);
      }
      console.log('Task %s has finished. application loading end.', label);
      process.exit(0);
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
  console.log('[+] Display configuration content:');
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
      console.log('[-] NULL: config of plugin [%s](%s) in application is undefined, use DEFAULT:\n%s',
          info.code, name, JSON.stringify(info.final, null, 2));
      break;

      case 0:
      console.log('[-] EMPTY: config of plugin [%s](%s) in application is empty, use DEFAULT:\n%s',
          info.code, name, JSON.stringify(info.final, null, 2));
      break;

      case 1:
      console.log('[-] OK: config of plugin [%s](%s) in application is defined, use MIXTURE:\n%s',
          info.code, name, JSON.stringify(info.final, null, 2));
      break;
    }
  });
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ default instance

let stateInspector;

Object.defineProperty(StateInspector, 'instance', {
  get: function() {
    return (stateInspector = stateInspector || new StateInspector());
  },
  set: function(value) {}
});
