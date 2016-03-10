'use strict';

var lodash = require('lodash');

var appinfoLoader = require('./lib/backbone/appinfo-loader.js');
var configLoader = require('./lib/backbone/config-loader.js');
var Server = require('./lib/server.js');
var debuglog = require('./lib/utils/debug.js')('devebot');

var logger = require('logdapter').defaultLogger;

function appLoader(params) {
  params = params || {};

  if (debuglog.isEnabled) {
    debuglog(' * devebot is started with parameters: %s', JSON.stringify(params, null, 2));
  }
  
  var appRootPath = params.appRootPath;
  var libRootPaths = params.libRootPaths || [];
  var topRootPath = __dirname;
  
  var config = configLoader(appRootPath, libRootPaths.concat(topRootPath));
  config.appinfo = appinfoLoader(appRootPath, libRootPaths, topRootPath);
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

appLoader.attachLayer = attachLayer;
appLoader.instantiate = instantiate;
appLoader.logger = logger;
appLoader.debug = require('./lib/utils/debug.js');

appLoader.pkg = {
  async: require('async'),
  bluebird: require('bluebird'),
  lodash: require('lodash')
};

module.exports = appLoader;