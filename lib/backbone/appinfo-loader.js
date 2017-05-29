'use strict';

var fs = require('fs');
var lodash = require('lodash');
var constx = require('../utils/constx.js');
var debugx = require('../utils/debug.js')('devebot:appinfoLoader');

function appinfoLoader(appRootPath, libRootPaths, botRootPath) {
  if (debugx.enabled) {
    debugx(' + load the application package at: %s', appRootPath);
    debugx(' - load the layerware packages at: %s', JSON.stringify(libRootPaths, null, 2));
    debugx(' - load the framework package at: %s', botRootPath);
  }

  var appinfo = loadPkginfo(appRootPath);

  if (!lodash.isArray(libRootPaths)) libRootPaths = [];
  appinfo.layerware = libRootPaths.map(function(libRootPath) {
    return loadPkginfo(libRootPath);
  });

  appinfo.framework = loadPkginfo(botRootPath);

  debugx.enabled && debugx(' - appinfo object: %s', JSON.stringify(appinfo, null, 2));

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
