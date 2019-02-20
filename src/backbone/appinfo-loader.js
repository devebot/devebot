'use strict';

const lodash = require('lodash');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

function appinfoLoader(appRootPath, libRootPaths, topRootPath) {
  const loggingWrapper = new LoggingWrapper(blockRef);
  const L = loggingWrapper.getLogger();
  const T = loggingWrapper.getTracer();

  if (L.has('dunce')) {
    L.log('dunce', ' + load the application package at: %s', appRootPath);
    L.log('dunce', ' - load the layerware packages at: %s', JSON.stringify(libRootPaths, null, 2));
    L.log('dunce', ' - load the framework package at: %s', topRootPath);
  }

  const appInfo = chores.loadPackageInfo(appRootPath, constx.APPINFO.FIELDS, {});

  if (!lodash.isArray(libRootPaths)) libRootPaths = [];
  appInfo.layerware = libRootPaths.map(function(libRootPath) {
    return chores.loadPackageInfo(libRootPath, constx.APPINFO.FIELDS, {});
  });

  appInfo.framework = chores.loadPackageInfo(topRootPath, constx.APPINFO.FIELDS, {});

  L.has('dunce') && L.log('dunce', ' - appInfo object: %s', JSON.stringify(appInfo, null, 2));

  return appInfo;
}

module.exports = appinfoLoader;
