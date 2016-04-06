'use strict';

var lodash = require('lodash');
var fs = require('fs');
var path = require('path');
var util = require('util');

var constx = require('./constx.js');
var loader = require('./loader.js');
var debug = require('./debug.js');
var debuglog = debug('devebot:chores');

var chores = {};

chores.pickProperty = function(propName, containers, propDefault) {
  if (!lodash.isString(propName) || !lodash.isArray(containers)) return null;
  for(var i=0; i<containers.length; i++) {
    if (lodash.isObject(containers[i]) && containers[i][propName]) {
      return containers[i][propName];
    }
  }
  return propDefault;
};

chores.listFiles = function(dir, filenames) {
  return chores.filterFiles(dir, filenames, '.*');
};

chores.filterFiles = function(dir, filter, filenames) {
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

chores.loadServiceByNames = function(serviceMap, serviceFolder, serviceNames) {
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

chores.stringKebabCase = function kebabCase(str) {
  return (str || '').toLowerCase().replace(' ', '-');
};

chores.stringLabelCase = function labelCase(str) {
  return (str || '').toUpperCase().replace('-', '_');
};

module.exports = chores;
