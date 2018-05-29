'use strict';

const path = require('path');
const lodash = require('lodash');

const appinfoLoader = require('./backbone/appinfo-loader');
const errorHandler = require('./backbone/error-handler').instance;
const stateInspector = require('./backbone/state-inspector').instance;
const ConfigLoader = require('./backbone/config-loader');
const LoggingWrapper = require('./backbone/logging-wrapper');
const NameResolver = require('./backbone/name-resolver');
const chores = require('./utils/chores');
const Runner = require('./runner');
const Server = require('./server');
const blockRef = chores.getBlockRef(__filename);

function runLoggingWrapper() {
  let loggingWrapper = new LoggingWrapper(blockRef);
  return {
    logger: loggingWrapper.getLogger(),
    tracer: loggingWrapper.getTracer()
  }
}

function appLoader(params) {
  params = params || {};

  let { logger: LX, tracer: LT } = runLoggingWrapper();
  let ctx = { LX, LT };

  LX.has('silly') && LX.log('silly', LT.add({
    context: lodash.cloneDeep(params)
  }).toMessage({
    tags: [ blockRef, 'constructor-begin', 'appLoader' ],
    text: ' + application loading start ...'
  }));

  LX.has('conlog') && LX.log('conlog', LT.add({
    context: params
  }).toMessage({
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

  LX.has('conlog') && LX.log('conlog', LT.add({
    appName: appName
  }).toMessage({
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

  let devebotRef = {
    type: 'framework',
    name: 'devebot',
    path: path.join(topRootPath, 'index.js')
  };

  let pluginRefList = lodash.values(params.pluginRefs);
  let bridgeRefList = lodash.values(params.bridgeRefs);
  let nameResolver = new NameResolver({ pluginRefs: pluginRefList, bridgeRefs: bridgeRefList });

  stateInspector.register({ nameResolver, pluginRefs: pluginRefList, bridgeRefs: bridgeRefList });

  let configLoader = new ConfigLoader({appName, appOptions, appRef, devebotRef,
    pluginRefs: params.pluginRefs, bridgeRefs: params.bridgeRefs, nameResolver
  });
  let config = configLoader.config;

  config.appName = appName;
  config.appInfo = appInfo;
  config.bridgeRefs = bridgeRefList;
  config.pluginRefs = [].concat(appRef || [], pluginRefList, devebotRef);

  let args = { configObject: config, nameResolver };
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

  let initialize = function(presets, pluginNames, bridgeNames, context) {
    presets = presets || {};
    context = context || {};
    if (typeof(presets.layerRootPath) === 'string' && presets.layerRootPath.length > 0) {
      context.libRootPaths = context.libRootPaths || [];
      context.libRootPaths.push(presets.layerRootPath);
    }
    if (chores.isFeatureSupported('presets')) {
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

let expandExtensions = function (context, pluginNames, bridgeNames) {
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
    if (chores.isFeatureSupported('presets')) {
      let item = lodash.isString(bridgeName) ? { name: bridgeName, path: bridgeName } : bridgeName;
      item.path = touchPackage(item, 'bridge', require.resolve);
      return item;
    }
    return lodash.isString(bridgeName) ? { name: bridgeName, path: bridgeName } : bridgeName;
  });
  let pluginInfos = lodash.map(pluginNames, function(pluginName) {
    if (chores.isFeatureSupported('presets')) {
      let item = lodash.isString(pluginName) ? { name: pluginName, path: pluginName } : pluginName;
      item.path = touchPackage(item, 'plugin', require.resolve);
      return item;
    }
    return lodash.isString(pluginName) ? { name: pluginName, path: pluginName } : pluginName;
  });

  let bridgeDiffs = lodash.differenceWith(bridgeInfos, lodash.keys(context.bridgeRefs), function(bridgeInfo, bridgeKey) {
    if (chores.isFeatureSupported('presets')) {
      return (bridgeInfo.path == bridgeKey);
    }
    return (bridgeInfo.name == bridgeKey);
  });
  let pluginDiffs = lodash.differenceWith(pluginInfos, lodash.keys(context.pluginRefs), function(pluginInfo, pluginKey) {
    if (chores.isFeatureSupported('presets')) {
      return (pluginInfo.path == pluginKey);
    }
    return (pluginInfo.name == pluginKey);
  });

  bridgeDiffs.forEach(function(bridgeInfo) {
    if (chores.isFeatureSupported('presets')) {
      let inc = lodash.pick(bridgeInfo, ['name', 'path']);
      context.bridgeRefs[bridgeInfo.path] = lodash.assign(context.bridgeRefs[bridgeInfo.path], inc);
      return;
    }
    context.bridgeRefs[bridgeInfo.name] = {
      name: bridgeInfo.name,
      path: touchPackage(bridgeInfo, 'bridge', require.resolve)
    }
  });

  pluginDiffs.forEach(function(pluginInfo) {
    if (chores.isFeatureSupported('presets')) {
      let inc = lodash.pick(pluginInfo, ['name', 'path', 'presets']);
      context.pluginRefs[pluginInfo.path] = lodash.assign(context.pluginRefs[pluginInfo.path], inc);
      return;
    }
    context.pluginRefs[pluginInfo.name] = {
      name: pluginInfo.name,
      path: touchPackage(pluginInfo, 'plugin', require.resolve)
    }
  });

  errorHandler.barrier({ invoker: blockRef });

  let pluginInitializers = lodash.map(pluginDiffs, function(pluginInfo) {
    if (chores.isFeatureSupported('presets')) {
      return {
        path: require.resolve(pluginInfo.path),
        initializer: require(pluginInfo.path)
      }
    }
    return require(pluginInfo.path);
  });

  return pluginInitializers.reduce(function(params, pluginInitializer) {
    if (chores.isFeatureSupported('presets')) {
      params.libRootPath = pluginInitializer.path;
      return pluginInitializer.initializer(params);
    }
    return pluginInitializer(params);
  }, context);
};

appLoader.registerLayerware = registerLayerware;
appLoader.launchApplication = launchApplication;

const builtinPackages = ['bluebird', 'lodash', 'injektor', 'logolite', 'schemato'];
const internalModules = ['chores', 'loader', 'pinbug'];

appLoader.require = function(packageName) {
  if (builtinPackages.indexOf(packageName) >= 0) return require(packageName);
  if (internalModules.indexOf(packageName) >= 0) return require('./utils/' + packageName);
  if (packageName == 'debug') return require('./utils/pinbug');
  return null;
};

let touchPackage = function(pkgInfo, pkgType, action) {
  try {
    return action(pkgInfo.path);
  } catch (err) {
    errorHandler.collect({
      stage: 'bootstrap',
      type: pkgType,
      name: pkgInfo.name,
      hasError: true,
      stack: err.stack
    });
  }
  return null;
}

module.exports = global.devebot = global.Devebot = appLoader;
