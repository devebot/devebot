'use strict';

const lodash = require('lodash');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

function appinfoLoader(appRootPath, libRootPaths, topRootPath) {
  let loggingWrapper = new LoggingWrapper(blockRef);
  let L = loggingWrapper.getLogger();
  let T = loggingWrapper.getTracer();

  if (L.has('dunce')) {
    L.log('dunce', ' + load the application package at: %s', appRootPath);
    L.log('dunce', ' - load the layerware packages at: %s', JSON.stringify(libRootPaths, null, 2));
    L.log('dunce', ' - load the framework package at: %s', topRootPath);
  }

  let appInfo = chores.loadPackageInfo(appRootPath);

  if (!lodash.isArray(libRootPaths)) libRootPaths = [];
  appInfo.layerware = libRootPaths.map(function(libRootPath) {
    return chores.loadPackageInfo(libRootPath);
  });

  appInfo.framework = chores.loadPackageInfo(topRootPath);

  L.has('dunce') && L.log('dunce', ' - appInfo object: %s', JSON.stringify(appInfo, null, 2));

  return appInfo;
}

module.exports = appinfoLoader;
