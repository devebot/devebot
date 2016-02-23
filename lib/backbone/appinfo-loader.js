'use strict';

var fs = require('fs');
var lodash = require('lodash');
var constx = require('../utils/constx.js');

function appinfoLoader(appRootPath, libRootPaths, botRootPath) {
  var appinfo = loadPkginfo(appRootPath);
  
  if (!lodash.isArray(libRootPaths)) libRootPaths = [];
  appinfo.layerware = libRootPaths.map(function(libRootPath) {
    return loadPkginfo(libRootPath);
  });

  appinfo.framework = loadPkginfo(botRootPath);

  return appinfo;
};

var loadPkginfo = function(pkgRootPath) {
  try {
    return lodash.pick(JSON.parse(fs.readFileSync(pkgRootPath + '/package.json', 'utf8')), 
      constx.APPINFO.FIELDS);
  } catch(err) {
    return {};
  }
};

module.exports = appinfoLoader;