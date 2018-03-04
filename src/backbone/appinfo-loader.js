'use strict';

var fs = require('fs');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var LoggingWrapper = require('./logging-wrapper');

function appinfoLoader(appRootPath, libRootPaths, topRootPath) {
  var loggingWrapper = new LoggingWrapper(chores.getBlockRef(__filename));
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  if (LX.has('conlog')) {
    LX.log('conlog', ' + load the application package at: %s', appRootPath);
    LX.log('conlog', ' - load the layerware packages at: %s', JSON.stringify(libRootPaths, null, 2));
    LX.log('conlog', ' - load the framework package at: %s', topRootPath);
  }

  var appinfo = chores.loadPackageInfo(appRootPath);

  if (!lodash.isArray(libRootPaths)) libRootPaths = [];
  appinfo.layerware = libRootPaths.map(function(libRootPath) {
    return chores.loadPackageInfo(libRootPath);
  });

  appinfo.framework = chores.loadPackageInfo(topRootPath);

  LX.has('conlog') && LX.log('conlog', ' - appinfo object: %s', JSON.stringify(appinfo, null, 2));

  return appinfo;
}

module.exports = appinfoLoader;
