'use strict';

var fs = require('fs');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var LoggingWrapper = require('./logging-wrapper');
var loggingWrapper = new LoggingWrapper(chores.getBlockRef(__filename));
var LX = loggingWrapper.getLogger();
var LT = loggingWrapper.getTracer();

function appinfoLoader(appRootPath, libRootPaths, botRootPath) {
  if (LX.has('conlog')) {
    LX.log('conlog', ' + load the application package at: %s', appRootPath);
    LX.log('conlog', ' - load the layerware packages at: %s', JSON.stringify(libRootPaths, null, 2));
    LX.log('conlog', ' - load the framework package at: %s', botRootPath);
  }

  var appinfo = loadPkginfo(appRootPath);

  if (!lodash.isArray(libRootPaths)) libRootPaths = [];
  appinfo.layerware = libRootPaths.map(function(libRootPath) {
    return loadPkginfo(libRootPath);
  });

  appinfo.framework = loadPkginfo(botRootPath);

  LX.has('conlog') && LX.log('conlog', ' - appinfo object: %s', JSON.stringify(appinfo, null, 2));

  return appinfo;
}

var loadPkginfo = function(pkgRootPath) {
  try {
    return lodash.pick(JSON.parse(fs.readFileSync(pkgRootPath + '/package.json', 'utf8')),
      constx.APPINFO.FIELDS);
  } catch(err) {
    return {};
  }
};

module.exports = appinfoLoader;
