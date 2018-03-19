'use strict';

var lodash = require('lodash');
var fs = require('fs');
var os = require('os');
var path = require('path');
var util = require('util');
var uuidv4 = require('logolite/uuidv4');
var constx = require('./constx.js');
var loader = require('./loader.js');
var debugx = require('./pinbug.js')('devebot:utils:chores');

let store = {
  injektorOptions: {
    namePatternTemplate: '^[a-zA-Z]{1}[a-zA-Z0-9&\\>\\-_%s]*$',
    separator: '/'
  },
  injektorContext: { scope: 'devebot' }
};
var chores = {};

chores.getUUID = function() {
  return uuidv4();
}

chores.loadPackageInfo = function(pkgRootPath) {
  try {
    return lodash.pick(JSON.parse(fs.readFileSync(pkgRootPath + '/package.json', 'utf8')),
      constx.APPINFO.FIELDS);
  } catch(err) {
    return {};
  }
};

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
      serviceEntry[chores.stringCamelCase(serviceName)] = serviceConstructor;
      lodash.defaults(serviceMap, serviceEntry);
    }
  });

  return serviceMap;
};

chores.isArray = function(a) {
  return a instanceof Array;
}

chores.isString = function(s) {
  return typeof(s) === 'string';
}

chores.stringKebabCase = function kebabCase(str) {
  if (!chores.isString(str)) return str;
  return str.toLowerCase().replace(/\s{1,}/g, '-');
};

chores.stringLabelCase = function labelCase(str) {
  if (!chores.isString(str)) return str;
  return str.toUpperCase().replace(/\W{1,}/g, '_');
};

chores.stringCamelCase = function camelCase(str) {
  if (!chores.isString(str)) return str;
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

var SPECIAL_PLUGINS = ['application', 'devebot'];

chores.isSpecialPlugin = function(pluginCode) {
  return (SPECIAL_PLUGINS.indexOf(pluginCode) >= 0);
}

chores.getPluginRefBy = function(selectedField, pluginDescriptor) {
  pluginDescriptor = pluginDescriptor || {};
  var pluginRef = pluginDescriptor[selectedField];
  if (pluginDescriptor.type === 'application') {
    pluginRef = pluginDescriptor.type;
  }
  return pluginRef;
}

chores.getBlockRef = function(filename, blockScope) {
  if (filename == null) return null;
  var blockName = chores.stringCamelCase(path.basename(filename, '.js'));
  blockScope = blockScope || 'devebot';
  if (!chores.isArray(blockScope)) blockScope = [blockScope];
  return blockScope.concat(blockName).join(chores.getSeparator());
}

chores.getSeparator = function() {
  return store.injektorOptions.separator;
};

chores.getFullname = function(parts, separator) {
  return lodash.filter(parts, lodash.negate(lodash.isEmpty))
      .join(separator || chores.getSeparator());
}

chores.injektorOptions = store.injektorOptions;

chores.injektorContext = store.injektorContext;

chores.skipProcessExit = function() {
  return process.env.DEVEBOT_SKIP_PROCESS_EXIT === 'true';
}

chores.isSilentForced = function(moduleId, cfg) {
  if (process.env.NODE_ENV === 'test') {
    store.fsm = null;
  }
  if (!store.fsm) {
    let fsstr = process.env.DEVEBOT_FORCING_SILENT || '';
    store.fsm = fsstr.split(',');
  }
  return (store.fsm.indexOf(moduleId) >= 0) || (cfg && cfg.verbose === false);
}

chores.isVerboseForced = function(moduleId, cfg) {
  if (process.env.NODE_ENV === 'test') {
    store.fvm = null;
  }
  if (!store.fvm) {
    let fvstr = process.env.DEVEBOT_FORCING_VERBOSE || '';
    store.fvm = fvstr.split(',');
  }
  return (store.fvm.indexOf(moduleId) >= 0) || (cfg && cfg.verbose !== false);
}

chores.isOldFeatures = function() {
  return process.env.DEVEBOT_FEATURE_MODE === 'old';
}

module.exports = chores;
