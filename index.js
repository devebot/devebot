'use strict';

var lodash = require('lodash');

var appinfoLoader = require('./lib/backbone/appinfo-loader.js');
var configLoader = require('./lib/backbone/config-loader.js');
var Server = require('./lib/server.js');

var debug = require('./lib/utils/debug.js');
var debuglog = debug('devebot');

var logger = require('logdapter').defaultLogger;

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
  config.pluginNames = params.pluginNames || [];
  config.bridgeNames = params.bridgeNames || [];
  config.moduleFolders = [].concat(appRootPath, libRootPaths, topRootPath);

  return {
    config: config,
    server: Server(config)
  };
}

function attachLayer(layerRootPath, params) {
  params = params || {};

  params.libRootPaths = params.libRootPaths || [];
  params.libRootPaths.push(layerRootPath);

  return params;
}

function instantiate(options, layers) {
  
  if (lodash.isString(options)) {
    options = { appRootPath: options };
  }
  
  if (!lodash.isArray(layers)) layers = [];
  var index = layers.indexOf(appLoader);
  if (index >= 0) {
    layers = layers.slice(0, index+1);
  } else {
    layers = layers.concat(appLoader);
  }
  
  return layers.reduce(function(params, plugin) {
    return plugin(params);
  }, options);
}

var ATTRS = ['libRootPaths', 'pluginNames', 'bridgeNames'];

function registerLayerware(layerRootPath, pluginNames, bridgeNames) {
  var initialize = function(layerRootPath, pluginNames, bridgeNames, context) {
    context = context || {};

    context.libRootPaths = context.libRootPaths || [];
    context.libRootPaths.push(layerRootPath);

    return expandExtensions(context, pluginNames, bridgeNames);  
  }
  return initialize.bind(undefined, layerRootPath, pluginNames, bridgeNames);
}

function launchApplication(context, pluginNames, bridgeNames) {
  if (lodash.isString(context)) {
    context = { appRootPath: context };
  }
  return appLoader(expandExtensions(
      lodash.omit(context, ATTRS),
      lodash.union(context.pluginNames, pluginNames),
      lodash.union(context.bridgeNames, bridgeNames)));
}

var expandExtensions = function (context, pluginNames, bridgeNames) {
  context = context || {};
  context = lodash.pick(context, ATTRS);

  context.libRootPaths = context.libRootPaths || [];
  context.pluginNames = context.pluginNames || [];
  context.bridgeNames = context.bridgeNames || [];

  pluginNames = lodash.isArray(pluginNames) ? pluginNames : [pluginNames];
  bridgeNames = lodash.isArray(bridgeNames) ? bridgeNames : [bridgeNames];

  pluginNames = lodash.diferrence(pluginNames, context.pluginNames);

  context.pluginNames = context.pluginNames.concat(pluginNames);
  context.bridgeNames = context.bridgeNames.concat(bridgeNames);

  var pluginInitializers = lodash.map(pluginNames, function(pluginName) {
    return require(pluginName);
  });

  return pluginInitializers.reduce(function(params, pluginInitializer) {
    return pluginInitializer(params);
  }, context);
}

appLoader.attachLayer = attachLayer;
appLoader.instantiate = instantiate;
appLoader.logger = logger;
appLoader.debug = debug;
appLoader.registerLayerware = registerLayerware;
appLoader.launchApplication = launchApplication;

appLoader.pkg = {
  async: require('async'),
  bluebird: require('bluebird'),
  lodash: require('lodash')
};

module.exports = appLoader;