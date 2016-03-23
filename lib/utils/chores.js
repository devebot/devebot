'use strict';

var lodash = require('lodash');
var fs = require('fs');
var path = require('path');
var util = require('util');

var constx = require('./constx.js');
var loader = require('./loader.js');

var debuglog = require('./debug.js')('devebot:chores');

var utils = {};

utils.pickProperty = function(propName, containers, propDefault) {
  if (!lodash.isString(propName) || !lodash.isArray(containers)) return null;
  for(var i=0; i<containers.length; i++) {
    if (lodash.isObject(containers[i]) && containers[i][propName]) {
      return containers[i][propName];
    }
  }
  return propDefault;
};

utils.listFiles = function(dir, filenames) {
  filenames = filenames || [];
  var files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    files = [];
  }
  for (var i in files) {
    var name = dir + '/' + files[i];
    if (fs.statSync(name).isFile()) {
      filenames.push(files[i]);
    }
  }
  return filenames;
};

utils.filterFiles = function(dir, filter, filenames) {
  filenames = filenames || [];
  var regex = (filter) ? new RegExp(filter) : null;
  var files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    files = [];
  }
  for (var i in files) {
    if ((regex) ? regex.test(files[i]) : true) {
      var name = dir + '/' + files[i];
      if (fs.statSync(name).isFile()) {
        filenames.push(files[i]);
      }
    }
  }
  return filenames;
};

utils.loadScriptEntries = function(scriptMap, scriptFolder, scriptKey, scriptContext) {
  var self = this;
  
  if (debuglog.isEnabled) {
    debuglog(' - load %s from folder: %s', scriptKey, scriptFolder);
  }

  var scriptFiles = utils.filterFiles(scriptFolder, scriptKey);
  scriptFiles.forEach(function(scriptFile) {
    utils.loadScriptEntry.call(self, scriptMap, scriptFolder, scriptFile, scriptContext);
  });
};

utils.loadScriptEntry = function(scriptMap, scriptFolder, scriptFile, scriptContext) {
  var filepath = path.join(scriptFolder, scriptFile);
  var scriptInit = loader(filepath);
  if (lodash.isFunction(scriptInit)) {
    var target = scriptInit(scriptContext);
    var entryPath = scriptFile.replace('.js', '').toLowerCase().split('_').reverse();
    entryPath.unshift(target);
    var entry = lodash.reduce(entryPath, function(result, item) {
      var nestEntry = {};
      nestEntry[item] = result;
      return nestEntry;
    });
    lodash.defaultsDeep(scriptMap, entry);
    if (debuglog.isEnabled) {
      debuglog(' - script file %s is ok', filepath);
    }
  } else {
    if (debuglog.isEnabled) {
      debuglog(' - script file %s doesnot contain a function.', filepath);
    }
  }
};

utils.loadServiceEntries = function(serviceMap, serviceFolder) {
  var self = this;
  
  if (debuglog.isEnabled) {
    debuglog(' - load services from folder: %s', serviceFolder);
  }

  var serviceFiles = utils.filterFiles(serviceFolder, '.*\.js');
  serviceFiles.forEach(function(serviceFile) {
    utils.loadServiceEntry.call(self, serviceMap, serviceFolder, serviceFile);
  });
};

utils.loadServiceEntry = function(serviceMap, serviceFolder, serviceFile) {
  var filepath = path.join(serviceFolder, serviceFile);
  var serviceConstructor = loader(filepath);
  if (lodash.isFunction(serviceConstructor)) {
    var serviceEntry = {};
    var entryPath = serviceFile.replace('.js', '').replace(/-([a-z])/g, function (m, w) {
      return w.toUpperCase();
    });
    serviceEntry[entryPath] = serviceConstructor;
    lodash.defaults(serviceMap, serviceEntry);
  }
};

utils.loadServiceByNames = function(serviceMap, serviceFolder, serviceNames) {
  var self = this;
  
  if (debuglog.isEnabled) {
    debuglog(' - load services by names: %s', JSON.stringify(serviceNames));
  }
  
  serviceNames = (lodash.isArray(serviceNames)) ? serviceNames : [serviceNames];
  
  serviceNames.forEach(function(serviceName) {
    var filepath = path.join(serviceFolder, serviceName + '.js');
    var serviceConstructor = loader(filepath);
    if (lodash.isFunction(serviceConstructor)) {
      var serviceEntry = {};
      var entryPath = serviceName.replace(/-([a-z])/g, function (m, w) {
        return w.toUpperCase();
      });
      serviceEntry[entryPath] = serviceConstructor;
      lodash.defaults(serviceMap, serviceEntry);
    }
  });
};

utils.stringKebabCase = function kebabCase(str) {
  return (str || '').toLowerCase().replace(' ', '-');
};

utils.stringLabelCase = function labelCase(str) {
  return (str || '').toUpperCase().replace('-', '_');
};

module.exports = utils;
