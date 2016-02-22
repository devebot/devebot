'use strict';

var fs = require('fs');
var lodash = require('lodash');
var constx = require('../utils/constx.js');

function initModule(appRootPath) {
  var devebotPkg = JSON.parse(fs.readFileSync(__dirname + '/../../package.json', 'utf8'));
  devebotPkg = lodash.pick(devebotPkg, constx.APPINFO.FIELDS);
  
  var applicationPkg = {};
  if (appRootPath) {
    applicationPkg = JSON.parse(fs.readFileSync(appRootPath + '/package.json', 'utf8'));
    applicationPkg = lodash.pick(applicationPkg, constx.APPINFO.FIELDS);
  }
  
  return lodash.assign(devebotPkg, applicationPkg);
};

module.exports = initModule;