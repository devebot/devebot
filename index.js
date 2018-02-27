'use strict';

var path = require('path');
var lodash = require('lodash');

var appinfoLoader = require('./lib/backbone/appinfo-loader.js');
var ConfigLoader = require('./lib/backbone/config-loader.js');
var LoggingWrapper = require('./lib/backbone/logging-wrapper.js');
var chores = require('./lib/utils/chores.js');
var Runner = require('./lib/runner.js');
var Server = require('./lib/server.js');

var loggingWrapper = new LoggingWrapper(chores.getBlockRef(__filename));
var LX = loggingWrapper.getLogger();
var LT = loggingWrapper.getTracer();

function appLoader(params) {
  params = params || {};

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + application loading start ...'
  }));

  LX.has('conlog') && LX.log('conlog', ' * application parameters: %s', JSON.stringify(params, null, 2));

  var appRootPath = params.appRootPath;
  var libRootPaths = lodash.map(params.pluginRefs, function(pluginRef) {
    return path.dirname(pluginRef.path);
  });
  var topRootPath = __dirname;

  var appinfo = appinfoLoader(appRootPath, libRootPaths, topRootPath);
  var appName = params.appName || appinfo.name || 'devebot-application';
  var appOptions = {
    privateProfile: params.privateProfile || params.privateProfiles,
    privateSandbox: params.privateSandbox || params.privateSandboxes
  };

  LX.has('conlog') && LX.log('conlog', ' - application name (appName): %s', appName);

  var configLoader = new ConfigLoader(appName, appOptions, appRootPath, libRootPaths.concat(topRootPath));
  var config = configLoader.config;

  var appRef = lodash.isEmpty(appRootPath) ? [] : {
    type: 'application',
    name: appName,
    path: path.join(appRootPath, 'app.js')
  };

  var devebotRef = {
    type: 'framework',
    name: 'devebot',
    path: path.join(topRootPath, 'index.js')
  };

  config.appName = appName;
  config.appinfo = appinfo;
  config.bridgeRefs = lodash.values(params.bridgeRefs);
  config.pluginRefs = [].concat(appRef, lodash.values(params.pluginRefs), devebotRef);

  var app = { config: config };

  var _runner;
  Object.defineProperty(app, 'runner', {
    get: function() { return _runner = _runner || new Runner(config) },
    set: function(value) {}
  });

  var _server;
  Object.defineProperty(app, 'server', {
    get: function() { return _server = _server || new Server(config) },
    set: function(value) {}
  });

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - Application loading has done'
  }));

  return app;
}

var ATTRS = ['libRootPaths', 'pluginRefs', 'bridgeRefs'];

function registerLayerware(layerRootPath, pluginNames, bridgeNames) {
  if ((arguments.length < 3) && lodash.isArray(layerRootPath)) {
    bridgeNames = pluginNames;
    pluginNames = layerRootPath;
    layerRootPath = null;
  }

  var initialize = function(layerRootPath, pluginNames, bridgeNames, context) {
    context = context || {};
    if (typeof(layerRootPath) == 'string' && layerRootPath.length > 0) {
      context.libRootPaths = context.libRootPaths || [];
      context.libRootPaths.push(layerRootPath);
    }
    return expandExtensions(context, pluginNames, bridgeNames);
  };

  return initialize.bind(undefined, layerRootPath, pluginNames, bridgeNames);
}

function launchApplication(context, pluginNames, bridgeNames) {
  if (lodash.isString(context)) {
    context = { appRootPath: context };
  }
  return appLoader(lodash.assign(context, expandExtensions(lodash.omit(context, ATTRS),
      pluginNames, bridgeNames)));
}

var expandExtensions = function (context, pluginNames, bridgeNames) {
  context = context || {};
  context = lodash.pick(context, ATTRS);

  context.libRootPaths = context.libRootPaths || [];
  context.bridgeRefs = context.bridgeRefs || {};
  context.pluginRefs = context.pluginRefs || {};

  bridgeNames = bridgeNames || [];
  pluginNames = pluginNames || [];

  bridgeNames = lodash.isArray(bridgeNames) ? bridgeNames : [bridgeNames];
  pluginNames = lodash.isArray(pluginNames) ? pluginNames : [pluginNames];

  var bridgeInfos = lodash.map(bridgeNames, function(bridgeName) {
    return lodash.isString(bridgeName) ? { name: bridgeName, path: bridgeName } : bridgeName;
  });
  var pluginInfos = lodash.map(pluginNames, function(pluginName) {
    return lodash.isString(pluginName) ? { name: pluginName, path: pluginName } : pluginName;
  });

  var bridgeDiffs = lodash.differenceWith(bridgeInfos, lodash.keys(context.bridgeRefs), function(bridgeInfo, bridgeKey) {
    return (bridgeInfo.name == bridgeKey);
  });
  var pluginDiffs = lodash.differenceWith(pluginInfos, lodash.keys(context.pluginRefs), function(pluginInfo, pluginKey) {
    return (pluginInfo.name == pluginKey);
  });

  bridgeDiffs.forEach(function(bridgeInfo) {
    context.bridgeRefs[bridgeInfo.name] = {
      name: bridgeInfo.name,
      path: require.resolve(bridgeInfo.path)
    }
  });

  pluginDiffs.forEach(function(pluginInfo) {
    context.pluginRefs[pluginInfo.name] = {
      name: pluginInfo.name,
      path: require.resolve(pluginInfo.path)
    }
  });

  var pluginInitializers = lodash.map(pluginDiffs, function(pluginInfo) {
    return require(pluginInfo.path);
  });

  return pluginInitializers.reduce(function(params, pluginInitializer) {
    return pluginInitializer(params);
  }, context);
};

appLoader.registerLayerware = registerLayerware;
appLoader.launchApplication = launchApplication;

var builtinPackages = ['bluebird', 'lodash', 'injektor'];

appLoader.require = function(packageName) {
  if (builtinPackages.indexOf(packageName) >= 0) return require(packageName);
  if (packageName == 'debug') return require('./lib/utils/pinbug.js');
  if (packageName == 'chores') return require('./lib/utils/chores.js');
  if (packageName == 'loader') return require('./lib/utils/loader.js');
  if (packageName == 'pinbug') return require('./lib/utils/pinbug.js');
  return null;
};

module.exports = global.devebot = global.Devebot = appLoader;
