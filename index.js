'use strict';

var path = require('path');
var lodash = require('lodash');

var appinfoLoader = require('./lib/backbone/appinfo-loader.js');
var configLoader = require('./lib/backbone/config-loader.js');
var Server = require('./lib/server.js');
var debug = require('./lib/utils/debug.js');
var debugx = debug('devebot');

function appLoader(params) {
  params = params || {};

  debugx.enabled && debugx(' * devebot is started with parameters: %s', JSON.stringify(params, null, 2));

  var appRootPath = params.appRootPath;
  var libRootPaths = lodash.map(params.pluginRefs, function(pluginRef) {
    return path.dirname(pluginRef.path);
  });
  var topRootPath = __dirname;

  var appinfo = appinfoLoader(appRootPath, libRootPaths, topRootPath);
  var appName = params.appName || appinfo.name || 'devebot-application';

  debugx.enabled && debugx(' - application name (appName): %s', appName);

  var config = configLoader(appName, appRootPath, libRootPaths.concat(topRootPath));

  var appRef = lodash.isEmpty(appRootPath) ? [] : {
    name: appName,
    path: path.join(appRootPath, 'app.js')
  };

  var devebotRef = {
    name: 'devebot',
    path: path.join(topRootPath, 'index.js')
  };

  config.appName = appName;
  config.appinfo = appinfo;
  config.bridgeRefs = lodash.values(params.bridgeRefs);
  config.pluginRefs = [].concat(appRef, lodash.values(params.pluginRefs), devebotRef);

  return {
    config: config,
    server: Server(config)
  };
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
  if (packageName == 'debug') return debug;
  if (packageName == 'chores') return require('./lib/utils/chores.js');
  if (packageName == 'loader') return require('./lib/utils/loader.js');
  return null;
};

module.exports = appLoader;
