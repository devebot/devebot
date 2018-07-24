'use strict';

const path = require('path');
const lodash = require('lodash');
const minimist = require('minimist');
const appinfoLoader = require('./backbone/appinfo-loader');
const ErrorCollector = require('./backbone/error-collector');
const StateInspector = require('./backbone/state-inspector');
const ConfigLoader = require('./backbone/config-loader');
const ContextManager = require('./backbone/context-manager');
const LoggingWrapper = require('./backbone/logging-wrapper');
const NameResolver = require('./backbone/name-resolver');
const chores = require('./utils/chores');
const constx = require('./utils/constx');
const envbox = require('./utils/envbox').instance;
const Runner = require('./runner');
const Server = require('./server');
const blockRef = chores.getBlockRef(__filename);
const errorCollector = ErrorCollector.instance;
const stateInspector = StateInspector.instance;

function appLoader(params) {
  params = params || {};

  let loggingWrapper = new LoggingWrapper(blockRef);
  let LX = loggingWrapper.getLogger();
  let LT = loggingWrapper.getTracer();
  let ctx = { LX, LT };

  LX.has('silly') && LX.log('silly', LT.add({ context: lodash.cloneDeep(params) }).toMessage({
    tags: [ blockRef, 'constructor-begin', 'appLoader' ],
    text: ' + application loading start ...'
  }));

  LX.has('conlog') && LX.log('conlog', LT.add({ context: params }).toMessage({
    text: ' * application parameters: ${context}'
  }));

  let appRootPath = params.appRootPath;
  let libRootPaths = lodash.map(params.pluginRefs, function(pluginRef) {
    return path.dirname(pluginRef.path);
  });
  let topRootPath = path.join(__dirname, '/..');

  let appInfo = appinfoLoader(appRootPath, libRootPaths, topRootPath);
  let appName = params.appName || appInfo.name || 'devebot-application';
  let appOptions = {
    privateProfile: params.privateProfile || params.privateProfiles,
    privateSandbox: params.privateSandbox || params.privateSandboxes
  };

  LX.has('conlog') && LX.log('conlog', LT.add({ appName }).toMessage({
    text: ' - application name (appName): ${appName}'
  }));

  let appRef = lodash.isEmpty(appRootPath) ? null : {
    type: 'application',
    name: appName,
    path: path.join(appRootPath, 'index.js')
  };
  if (lodash.isObject(params.presets)) {
    appRef.presets = lodash.cloneDeep(params.presets);
  }

  envbox.setNamespace(chores.stringLabelCase(appName));

  let devebotRef = {
    type: 'framework',
    name: 'devebot',
    path: path.join(topRootPath, 'index.js')
  };

  let pluginRefList = lodash.values(params.pluginRefs);
  let bridgeRefList = lodash.values(params.bridgeRefs);
  let nameResolver = new NameResolver({ errorCollector, pluginRefs: pluginRefList, bridgeRefs: bridgeRefList });

  stateInspector.register({ nameResolver, pluginRefs: pluginRefList, bridgeRefs: bridgeRefList });

  let configLoader = new ConfigLoader({appName, appOptions, appRef, devebotRef,
    pluginRefs: params.pluginRefs, bridgeRefs: params.bridgeRefs, errorCollector, stateInspector, nameResolver
  });
  let config = configLoader.config;

  config.appName = appName;
  config.appInfo = appInfo;
  config.bridgeRefs = bridgeRefList;
  config.pluginRefs = [].concat(appRef || [], pluginRefList, devebotRef);

  let contextManager = new ContextManager({ errorCollector });

  let args = { configObject: config, contextManager, errorCollector, stateInspector, nameResolver };
  let app = { config: config };

  let _runner;
  Object.defineProperty(app, 'runner', {
    get: function() { return _runner = _runner || new Runner(args) },
    set: function(value) {}
  });

  let _server;
  Object.defineProperty(app, 'server', {
    get: function() { return _server = _server || new Server(args) },
    set: function(value) {}
  });

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end', 'appLoader' ],
    text: ' - Application loading has done'
  }));

  return app;
}

const ATTRS = ['libRootPaths', 'pluginRefs', 'bridgeRefs'];

function registerLayerware(presets, pluginNames, bridgeNames) {
  if ((arguments.length < 3) && lodash.isArray(presets)) {
    bridgeNames = pluginNames;
    pluginNames = presets;
    presets = null;
  }

  if (lodash.isString(presets)) {
    presets = { layerRootPath: presets };
  }

  function initialize(presets, pluginNames, bridgeNames, context) {
    presets = presets || {};
    context = context || {};
    if (typeof(presets.layerRootPath) === 'string' && presets.layerRootPath.length > 0) {
      context.libRootPaths = context.libRootPaths || [];
      context.libRootPaths.push(presets.layerRootPath);
    }
    if (chores.isUpgradeSupported('presets')) {
      if (context.libRootPath) {
        let _presets = lodash.get(context, ['pluginRefs', context.libRootPath, 'presets'], null);
        if (_presets) {
          lodash.defaultsDeep(_presets, presets);
        } else {
          lodash.set(context, ['pluginRefs', context.libRootPath, 'presets'], presets);
        }
      }
    }
    return expandExtensions(context, pluginNames, bridgeNames);
  };

  return initialize.bind(undefined, presets, pluginNames, bridgeNames);
}

function launchApplication(context, pluginNames, bridgeNames) {
  if (lodash.isString(context)) {
    context = { appRootPath: context };
  }
  return appLoader(lodash.assign(context, expandExtensions(lodash.omit(context, ATTRS), pluginNames, bridgeNames)));
}

function expandExtensions(context, pluginNames, bridgeNames) {
  context = context || {};
  context = lodash.pick(context, ATTRS);

  context.libRootPaths = context.libRootPaths || [];
  context.bridgeRefs = context.bridgeRefs || {};
  context.pluginRefs = context.pluginRefs || {};

  bridgeNames = bridgeNames || [];
  pluginNames = pluginNames || [];

  bridgeNames = lodash.isArray(bridgeNames) ? bridgeNames : [bridgeNames];
  pluginNames = lodash.isArray(pluginNames) ? pluginNames : [pluginNames];

  let bridgeInfos = lodash.map(bridgeNames, function(bridgeName) {
    if (chores.isUpgradeSupported('presets')) {
      let item = lodash.isString(bridgeName) ? { name: bridgeName, path: bridgeName } : bridgeName;
      item.path = touchPackage(item, 'bridge', require.resolve);
      return item;
    }
    return lodash.isString(bridgeName) ? { name: bridgeName, path: bridgeName } : bridgeName;
  });
  let pluginInfos = lodash.map(pluginNames, function(pluginName) {
    if (chores.isUpgradeSupported('presets')) {
      let item = lodash.isString(pluginName) ? { name: pluginName, path: pluginName } : pluginName;
      item.path = touchPackage(item, 'plugin', require.resolve);
      return item;
    }
    return lodash.isString(pluginName) ? { name: pluginName, path: pluginName } : pluginName;
  });

  let bridgeDiffs = lodash.differenceWith(bridgeInfos, lodash.keys(context.bridgeRefs), function(bridgeInfo, bridgeKey) {
    if (chores.isUpgradeSupported('presets')) {
      return (bridgeInfo.path == bridgeKey);
    }
    return (bridgeInfo.name == bridgeKey);
  });
  let pluginDiffs = lodash.differenceWith(pluginInfos, lodash.keys(context.pluginRefs), function(pluginInfo, pluginKey) {
    if (chores.isUpgradeSupported('presets')) {
      return (pluginInfo.path == pluginKey);
    }
    return (pluginInfo.name == pluginKey);
  });

  bridgeDiffs.forEach(function(bridgeInfo) {
    if (chores.isUpgradeSupported('presets')) {
      let inc = lodash.pick(bridgeInfo, ['name', 'path', 'presets']);
      context.bridgeRefs[bridgeInfo.path] = lodash.assign(context.bridgeRefs[bridgeInfo.path], inc);
      return;
    }
    context.bridgeRefs[bridgeInfo.name] = {
      name: bridgeInfo.name,
      path: touchPackage(bridgeInfo, 'bridge', require.resolve)
    }
  });

  pluginDiffs.forEach(function(pluginInfo) {
    if (chores.isUpgradeSupported('presets')) {
      let inc = lodash.pick(pluginInfo, ['name', 'path', 'presets']);
      context.pluginRefs[pluginInfo.path] = lodash.assign(context.pluginRefs[pluginInfo.path], inc);
      return;
    }
    context.pluginRefs[pluginInfo.name] = {
      name: pluginInfo.name,
      path: touchPackage(pluginInfo, 'plugin', require.resolve)
    }
  });

  errorCollector.barrier({ invoker: blockRef, footmark: 'package-touching' });

  let pluginInitializers = lodash.map(pluginDiffs, function(pluginInfo) {
    if (chores.isUpgradeSupported('presets')) {
      return {
        path: require.resolve(pluginInfo.path),
        initializer: require(pluginInfo.path)
      }
    }
    return require(pluginInfo.path);
  });

  return pluginInitializers.reduce(function(params, pluginInitializer) {
    if (chores.isUpgradeSupported('presets')) {
      params.libRootPath = pluginInitializer.path;
      return pluginInitializer.initializer(params);
    }
    return pluginInitializer(params);
  }, context);
};

let bootstrap = {};

bootstrap.registerLayerware = registerLayerware;
bootstrap.launchApplication = launchApplication;

// @Deprecated
bootstrap.parseArguments = function(active) {
  return this.initialize('actions', { enabled: active, forced: true });
}

bootstrap.initialize = function(action, options) {
  options = options || {};
  if (['actions', 'tasks'].indexOf(action) >= 0) {
    if (options.enabled !== false) {
      let argv = minimist(process.argv.slice(2));
      let tasks = argv.tasks || argv.actions;
      if (lodash.isEmpty(tasks)) {
        if (options.forced && !lodash.isEmpty(argv._)) {
          console.log('Incorrect task(s). Should be: (--tasks=print-config,check-config)');
          process.exit(0);
        }
      } else {
        let jobs = stateInspector.init({ tasks });
        if (lodash.isEmpty(jobs)) {
          console.log('Unknown task(s): (%s)!', tasks);
          process.exit(0);
        }
      }
    }
  }
  return this;
}

const builtinPackages = ['bluebird', 'lodash', 'injektor', 'logolite', 'schemato', 'semver'];
const internalModules = ['chores', 'loader', 'pinbug', 'errors'];

bootstrap.require = function(packageName) {
  if (builtinPackages.indexOf(packageName) >= 0) return require(packageName);
  if (internalModules.indexOf(packageName) >= 0) return require('./utils/' + packageName);
  if (packageName == 'debug') return require('./utils/pinbug');
  return null;
};

let touchPackage = function(pkgInfo, pkgType, action) {
  try {
    return action(pkgInfo.path);
  } catch (err) {
    errorCollector.collect({
      stage: 'bootstrap',
      type: pkgType,
      name: pkgInfo.name,
      hasError: true,
      stack: err.stack
    });
  }
  return null;
}

module.exports = global.devebot = global.Devebot = bootstrap;
