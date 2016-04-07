'use strict';

var lodash = require('lodash');

var appinfoLoader = require('./lib/backbone/appinfo-loader.js');
var configLoader = require('./lib/backbone/config-loader.js');
var Server = require('./lib/server.js');
var debug = require('./lib/utils/debug.js');
var debuglog = debug('devebot');

function appLoader(params) {
  params = params || {};

  if (debuglog.isEnabled) {
    debuglog(' * devebot is started with parameters: %s', JSON.stringify(params, null, 2));
  }
  
  var appRootPath = params.appRootPath;
  var libRootPaths = params.libRootPaths || [];
  var topRootPath = __dirname;
  
  var appinfo = appinfoLoader(appRootPath, libRootPaths, topRootPath);
  var appName = params.appName || appinfo.name || appinfo.framework.name || 'devebot';
  if (debuglog.isEnabled) {
    debuglog(' - application name: %s', appName);
  }
  
  var config = configLoader(appName, appRootPath, libRootPaths.concat(topRootPath));
  
  config.appName = appName;
  config.appinfo = appinfo;
  config.bridgeRefs = lodash.values(params.bridgeRefs || {});
  config.pluginRefs = lodash.values(params.pluginRefs || {});
  config.bridgeNames = params.bridgeNames || [];
  config.pluginNames = params.pluginNames || [];
  config.pluginRootDirs = [].concat(appRootPath, libRootPaths, topRootPath);

  return {
    config: config,
    server: Server(config)
  };
}

var ATTRS = ['libRootPaths', 'pluginRefs', 'bridgeRefs', 'pluginNames', 'bridgeNames'];

function registerLayerware(layerRootPath, pluginNames, bridgeNames) {
  var initialize = function(layerRootPath, pluginNames, bridgeNames, context) {
    context = context || {};
    pluginNames = pluginNames || [];
    bridgeNames = bridgeNames || [];

    context.libRootPaths = context.libRootPaths || [];
    context.libRootPaths.push(layerRootPath);

    return expandExtensions(context, pluginNames, bridgeNames);  
  };
  return initialize.bind(undefined, layerRootPath, pluginNames, bridgeNames);
}

function launchApplication(context, pluginNames, bridgeNames) {
  if (lodash.isString(context)) {
    context = { appRootPath: context };
  }
  return appLoader(lodash.assign(context, expandExtensions(lodash.omit(context, ATTRS),
      lodash.union(context.pluginNames, pluginNames),
      lodash.union(context.bridgeNames, bridgeNames))));
}

var expandExtensions = function (context, pluginNames, bridgeNames) {
  context = context || {};
  context = lodash.pick(context, ATTRS);

  context.libRootPaths = context.libRootPaths || [];
  context.bridgeRefs = context.bridgeRefs || {};
  context.pluginRefs = context.pluginRefs || {};
  context.bridgeNames = context.bridgeNames || [];
  context.pluginNames = context.pluginNames || [];

  bridgeNames = lodash.isArray(bridgeNames) ? bridgeNames : [bridgeNames];
  pluginNames = lodash.isArray(pluginNames) ? pluginNames : [pluginNames];

  bridgeNames = lodash.difference(bridgeNames, lodash.keys(context.bridgeRefs));
  pluginNames = lodash.difference(pluginNames, lodash.keys(context.pluginRefs));

  bridgeNames.forEach(function(bridgeName) {
    context.bridgeRefs[bridgeName] = {
      name: bridgeName,
      path: require.resolve(bridgeName)
    }
    require(context.bridgeRefs[bridgeName].path);
  });

  pluginNames.forEach(function(pluginName) {
    context.pluginRefs[pluginName] = {
      name: pluginName, 
      path: require.resolve(pluginName)
    }
    require(context.pluginRefs[pluginName].path);
  });

  context.bridgeNames = lodash.union(context.bridgeNames, bridgeNames);
  context.pluginNames = lodash.union(context.pluginNames, pluginNames);

  var pluginInitializers = lodash.map(pluginNames, function(pluginName) {
    return require(pluginName);
  });

  return pluginInitializers.reduce(function(params, pluginInitializer) {
    return pluginInitializer(params);
  }, context);
};

appLoader.registerLayerware = registerLayerware;
appLoader.launchApplication = launchApplication;

var builtinPackages = ['async', 'bluebird', 'lodash'];

appLoader.require = function(packageName) {
  if (builtinPackages.indexOf(packageName) >= 0) return require(packageName);
  if (packageName == 'debug') return debug;
  return null;
};

module.exports = appLoader;
