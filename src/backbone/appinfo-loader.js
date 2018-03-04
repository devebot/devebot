'use strict';

var fs = require('fs');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var LoggingWrapper = require('./logging-wrapper');

function appinfoLoader(appRootPath, libRootPaths, botRootPath) {
  var loggingWrapper = new LoggingWrapper(chores.getBlockRef(__filename));
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  if (LX.has('conlog')) {
    LX.log('conlog', ' + load the application package at: %s', appRootPath);
    LX.log('conlog', ' - load the layerware packages at: %s', JSON.stringify(libRootPaths, null, 2));
    LX.log('conlog', ' - load the framework package at: %s', botRootPath);
  }

  var appinfo = chores.loadPkginfo(appRootPath);

  if (!lodash.isArray(libRootPaths)) libRootPaths = [];
  appinfo.layerware = libRootPaths.map(function(libRootPath) {
    return chores.loadPkginfo(libRootPath);
  });

  appinfo.framework = chores.loadPkginfo(botRootPath);

  LX.has('conlog') && LX.log('conlog', ' - appinfo object: %s', JSON.stringify(appinfo, null, 2));

  return appinfo;
}

module.exports = appinfoLoader;
