'use strict';

var lodash = require('lodash');
var fs = require('fs');
var path = require('path');
var util = require('util');

var Validator = require('jsonschema').Validator;
var validator = new Validator();

var constx = require('./constx.js');
var loader = require('./loader.js');
var debuglog = require('./debug.js')('devebot:chores');

var utils = {};

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

utils.validateCommand = function(target) {
  target = target || {};
  var results = [];
  
  var targetProps = lodash.pick(target, lodash.keys(constx.COMMAND.SCHEMA.OBJECT.properties));
  results.push(validator.validate(targetProps, constx.COMMAND.SCHEMA.OBJECT));
  
  if (!lodash.isFunction(target.handler)) {
    results.push({
      valid: false,
      errors: [{
        message: 'handler has wrong type: ' + typeof(target.handler)
      }]
    });
  }
  
  return results.reduce(function(output, result) {
    output.valid = output.valid && (result.valid != false);
    output.errors = output.errors.concat(result.errors);
    return output;
  }, { valid: true, errors: [] });
};

module.exports = utils;
