'use strict';

var assert = require('assert');
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
    namePatternTemplate: '^[a-zA-Z]{1}[a-zA-Z0-9&#\\-_%s]*$',
    separator: '/'
  },
  injektorContext: { scope: 'devebot' }
};
var chores = {};

var CustomError = function(message, payload) {
  Error.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.message = message;
  this.payload = payload;
}
util.inherits(CustomError, Error);

chores.buildError = function(errorName) {
  var ErrorConstructor = function() {
    CustomError.apply(this, arguments);
    this.name = errorName;
  }
  util.inherits(ErrorConstructor, CustomError);
  return ErrorConstructor;
}

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

chores.extractCodeByPattern = function(ctx, patterns, name) {
  assert.ok(patterns instanceof Array);
  for(let k in patterns) {
    assert.ok(patterns[k] instanceof RegExp);
  }
  let {LX, LT} = ctx;
  let info = {};
  for(info.i=0; info.i<patterns.length; info.i++) {
    if (name.match(patterns[info.i])) break;
  }
  if (info.i >= patterns.length) {
    LX.has('conlog') && LX.log('conlog', LT.add({
      name: name
    }).toMessage({
      text: ' - The name "${name}" is not matched the patterns'
    }));
    return { i: -1, code: name };
  }
  info.code = name.replace(patterns[info.i], '\$1')
    .replace(/-([a-z])/g, function (m, w) { return w.toUpperCase(); })
    .replace(/-([0-9])/g, function (m, w) { return '_' + w; });
  LX.has('conlog') && LX.log('conlog', LT.add({
    name: name,
    code: info.code
  }).toMessage({
    text: ' - extracted code of "${name}" is "${code}"'
  }));
  return info;
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

chores.printError = function(err) {
  [
    '',
    '========== FATAL ERROR ==========',
    err,
    '---------------------------------',
    ''
  ].forEach(function(item) {
    debugx.enabled && debugx(item);
  });
}

chores.isOldFeatures = function() {
  return process.env.DEVEBOT_FEATURE_MODE === 'old';
}

var stringToArray = function(labels) {
  labels = labels || '';
  return labels.split(',').map(function(item) {
    return item.trim();
  });
}

chores.isFeatureSupported = function(label) {
  if (process.env.NODE_ENV === 'test') {
    store.featureDisabled = null;
    store.featureEnabled = null;
  }
  if (!store.featureDisabled) {
    store.featureDisabled = stringToArray(process.env.DEVEBOT_FEATURE_DISABLED);
  }
  if (!store.featureEnabled) {
    store.featureEnabled = stringToArray(process.env.DEVEBOT_FEATURE_ENABLED ||
      process.env.DEVEBOT_FEATURE_LABELS);
  }
  if (store.featureDisabled.indexOf(label) >= 0) return false;
  if (constx.FEATURE_ENABLED.indexOf(label) >= 0) return true;
  return (store.featureEnabled.indexOf(label) >= 0);
}

module.exports = chores;
