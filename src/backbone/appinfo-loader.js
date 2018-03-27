'use strict';

var fs = require('fs');
var lodash = require('lodash');
var chores = require('../utils/chores');
var constx = require('../utils/constx');

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

  var appInfo = chores.loadPackageInfo(appRootPath);

  if (!lodash.isArray(libRootPaths)) libRootPaths = [];
  appInfo.layerware = libRootPaths.map(function(libRootPath) {
    return chores.loadPackageInfo(libRootPath);
  });

  appInfo.framework = chores.loadPackageInfo(topRootPath);

  LX.has('conlog') && LX.log('conlog', ' - appInfo object: %s', JSON.stringify(appInfo, null, 2));

  return appInfo;
}

module.exports = appinfoLoader;
