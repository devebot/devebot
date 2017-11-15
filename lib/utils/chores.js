'use strict';

var lodash = require('lodash');
var fs = require('fs');
var path = require('path');
var util = require('util');
var os = require('os');
var constx = require('./constx.js');
var loader = require('./loader.js');
var debugx = require('./debug.js')('devebot:utils:chores');

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
  
  debugx.enabled && debugx(' - load services by names: %s', JSON.stringify(serviceNames));
  
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

chores.stringCamelCase = function camelCase(str) {
  if (!str) return str;
  return str.replace(/-([a-z])/g, function (m, w) {
    return w.toUpperCase();
  });
}

chores.assertDir = function(appName) {
  var configDir = path.join(this.homedir(), '.' + appName);
  debugx.enabled && debugx('config in homeDir: %s', configDir);
  try {
    fs.readdirSync(configDir);
  } catch (err) {
    if (err.code == 'ENOENT') {
      try {
        fs.mkdirSync(configDir);
      } catch (err) {
        return null;
      }
    } else {
      return null;
    }
  }
  return configDir;
}

chores.homedir = (typeof os.homedir === 'function') ? os.homedir : function() {
  var env = process.env;
  var home = env.HOME;
  var user = env.LOGNAME || env.USER || env.LNAME || env.USERNAME;

  if (process.platform === 'win32') {
    return env.USERPROFILE || env.HOMEDRIVE + env.HOMEPATH || home || null;
  }

  if (process.platform === 'darwin') {
    return home || (user ? '/Users/' + user : null);
  }

  if (process.platform === 'linux') {
    return home || (process.getuid() === 0 ? '/root' : (user ? '/home/' + user : null));
  }

  return home || null;
};

module.exports = chores;
