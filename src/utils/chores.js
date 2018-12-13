'use strict';

const assert = require('assert');
const lodash = require('lodash');
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const uuidv4 = require('logolite/uuidv4');
const format = require('logolite/lib/format');
const Validator = require('schemato').Validator;
const constx = require('./constx');
const loader = require('./loader');
const envbox = require('./envbox');
const nodash = require('./nodash');
const getenv = require('./getenv');

let store = {
  defaultScope: getenv('DEVEBOT_DEFAULT_SCOPE', constx.FRAMEWORK.NAME),
  injektorOptions: {
    namePatternTemplate: '^[a-zA-Z]{1}[a-zA-Z0-9&#\\-_%s]*$',
    separator: '/'
  },
  injektorContext: { scope: constx.FRAMEWORK.NAME },
  validatorOptions: { schemaVersion: 4 }
};
let chores = {};

// @Deprecated
let CustomError = function(message, payload) {
  Error.call(this, message);
  Error.captureStackTrace(this, this.constructor);
  this.message = message;
  this.payload = payload;
}
util.inherits(CustomError, Error);

chores.buildError = function(errorName) {
  let ErrorConstructor = function() {
    CustomError.apply(this, arguments);
    this.name = errorName;
  }
  util.inherits(ErrorConstructor, CustomError);
  return ErrorConstructor;
}

chores.getUUID = function() {
  return uuidv4();
}

chores.formatTemplate = function(tmpl, data) {
  return format(tmpl, data);
}

chores.loadPackageInfo = function(pkgRootPath) {
  try {
    return lodash.pick(JSON.parse(fs.readFileSync(pkgRootPath + '/package.json', 'utf8')),
      constx.APPINFO.FIELDS);
  } catch(err) {
    return {};
  }
};

chores.getFirstDefinedValue = function() {
  let val = undefined;
  for(let i=0; i<arguments.length; i++) {
    val = arguments[i];
    if (val !== undefined && val !== null) break;
  }
  return val;
}

chores.isOwnOrInheritedProperty = function(object, property) {
  for(let propName in object) {
    if (propName === property) return true;
  }
  return object.hasOwnProperty(property);
}

chores.pickProperty = function(propName, containers, propDefault) {
  if (!lodash.isString(propName) || !lodash.isArray(containers)) return null;
  for(let i=0; i<containers.length; i++) {
    if (lodash.isObject(containers[i]) && containers[i][propName]) {
      return containers[i][propName];
    }
  }
  return propDefault;
};

chores.deepFreeze = function (o) {
  let self = this;
  Object.freeze(o);
  Object.getOwnPropertyNames(o).forEach(function (prop) {
    if (o.hasOwnProperty(prop)
        && (nodash.isObject(o[prop]) || nodash.isFunction(o[prop]))
        && !Object.isFrozen(o[prop])) {
      self.deepFreeze(o[prop]);
    }
  });
  return o;
}

chores.fileExists = function(filepath) {
  return fs.existsSync(filepath);
}

chores.filterFiles = function(dir, filter, filenames) {
  filenames = filenames || [];
  let regex = (filter) ? new RegExp(filter) : null;
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    files = [];
  }
  for (let i in files) {
    if ((regex) ? regex.test(files[i]) : true) {
      let name = dir + '/' + files[i];
      if (fs.statSync(name).isFile()) {
        filenames.push(files[i]);
      }
    }
  }
  return filenames;
};

chores.loadServiceByNames = function(serviceMap, serviceFolder, serviceNames) {
  serviceNames = nodash.arrayify(serviceNames);
  serviceNames.forEach(function(serviceName) {
    let filepath = path.join(serviceFolder, serviceName + '.js');
    let serviceConstructor = loader(filepath);
    if (lodash.isFunction(serviceConstructor)) {
      let serviceEntry = {};
      serviceEntry[chores.stringCamelCase(serviceName)] = serviceConstructor;
      lodash.defaults(serviceMap, serviceEntry);
    }
  });
  return serviceMap;
};

chores.stringKebabCase = function kebabCase(str) {
  if (!nodash.isString(str)) return str;
  return str.toLowerCase().replace(/\s{1,}/g, '-');
};

chores.stringLabelCase = function labelCase(str) {
  if (!nodash.isString(str)) return str;
  return str.toUpperCase().replace(/\W{1,}/g, '_');
};

chores.stringCamelCase = function camelCase(str) {
  if (!nodash.isString(str)) return str;
  return str
    .replace(/-([a-z])/g, function (m, w) { return w.toUpperCase(); })
    .replace(/-([0-9])/g, function (m, w) { return '_' + w; });
}

chores.assertDir = function(appName) {
  let configDir = path.join(this.homedir(), '.' + appName);
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
  let env = process.env;
  let home = env.HOME;
  let user = env.LOGNAME || env.USER || env.LNAME || env.USERNAME;

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

const SPECIAL_PLUGINS = ['application', constx.FRAMEWORK.NAME];

chores.isSpecialPlugin = function(pluginCode) {
  return (SPECIAL_PLUGINS.indexOf(pluginCode) >= 0);
}

chores.extractCodeByPattern = function(ctx, patterns, name) {
  assert.ok(patterns instanceof Array);
  for(let k in patterns) {
    assert.ok(patterns[k] instanceof RegExp);
  }
  let {L, T} = ctx;
  let info = {};
  for(info.i=0; info.i<patterns.length; info.i++) {
    if (name.match(patterns[info.i])) break;
  }
  if (info.i >= patterns.length) {
    L.has('dunce') && L.log('dunce', T.add({ name }).toMessage({
      text: ' - The name "${name}" is not matched the patterns'
    }));
    return { i: -1, code: name };
  }
  info.code = name.replace(patterns[info.i], '\$1');
  L.has('dunce') && L.log('dunce', T.add(lodash.assign({name}, info)).toMessage({
    text: ' - extracted code of "${name}" is "${code}"'
  }));
  return info;
}

chores.getComponentDir = function(pluginRef, componentType) {
  let compDir = lodash.get(pluginRef, ['presets', 'componentDir'], {});
  if (componentType) {
    return compDir[componentType] || constx[componentType].SCRIPT_DIR;
  }
  return compDir;
}

chores.getBlockRef = function(filename, blockScope) {
  if (filename == null) return null;
  let blockName = chores.stringCamelCase(path.basename(filename, '.js'));
  blockScope = blockScope || store.defaultScope;
  if (!nodash.isArray(blockScope)) blockScope = [blockScope];
  return blockScope.concat(blockName).join(chores.getSeparator());
}

chores.getSeparator = function() {
  return store.injektorOptions.separator;
};

chores.getFullname = function(parts, separator) {
  return lodash.filter(parts, lodash.negate(lodash.isEmpty)).join(separator || chores.getSeparator());
}

chores.toFullname = function() {
  return lodash.filter(arguments, lodash.negate(lodash.isEmpty)).join(store.injektorOptions.separator);
}

chores.transformBeanName = function(name, opts) {
  opts = opts || {};
  if (typeof name !== 'string') return name;
  let pattern = (opts.namePattern instanceof RegExp) ? opts.namePattern : /^(.+)\/([^:^\/]+)$/g;
  return name.replace(pattern, "$1:$2");
}

chores.lookupMethodRef = function(methodName, serviceName, proxyName, sandboxRegistry) {
  let ref = {};
  let commander = sandboxRegistry.lookupService(proxyName);
  if (commander && lodash.isFunction(commander.lookupService)) {
    ref.isDirected = false;
    ref.isRemote = true;
    ref.service = commander.lookupService(serviceName);
    if (ref.service) {
      ref.method = ref.service[methodName];
    }
  }
  if (!ref.method) {
    ref.isDirected = true;
    ref.isRemote = false;
    ref.service = sandboxRegistry.lookupService(serviceName);
    if (ref.service) {
      ref.method = ref.service[methodName];
    }
  }
  return ref;
}

chores.printError = function(err) {
  if (getenv(['DEVEBOT_ENV', 'NODE_ENV']) !== 'test') {
    [
      '',
      '========== FATAL ERROR ==========',
      err,
      '---------------------------------',
      ''
    ].forEach(function(item) {
      console.error(item);
    });
  }
}

chores.injektorOptions = store.injektorOptions;

chores.injektorContext = store.injektorContext;

chores.isDevelopmentMode = function() {
  return ['test', 'dev', 'development'].indexOf(envbox.getEnv('ENV')) >= 0;
}

chores.fatalErrorReaction = function() {
  return envbox.getEnv('FATAL_ERROR_REACTION');
}

chores.skipProcessExit = function() {
  return envbox.getEnv('SKIP_PROCESS_EXIT') === 'true';
}

chores.isSilentForced = function(moduleId, cfg) {
  let fsm = envbox.getEnv('FORCING_SILENT');
  return (fsm.indexOf(moduleId) >= 0) || (cfg && cfg.verbose === false);
}

chores.isVerboseForced = function(moduleId, cfg) {
  let fvm = envbox.getEnv('FORCING_VERBOSE');
  return (fvm.indexOf(moduleId) >= 0) || (cfg && cfg.verbose !== false);
}

chores.clearCache = function() {
  store.upgradeDisabled = null;
  store.upgradeEnabled = null;
  return this;
}

chores.isUpgradeSupported = function(label) {
  if (!store.upgradeDisabled) {
    store.upgradeDisabled = envbox.getEnv('UPGRADE_DISABLED');
  }
  if (!store.upgradeEnabled) {
    store.upgradeEnabled = envbox.getEnv('UPGRADE_ENABLED');
  }
  label = nodash.isArray(label) ? label : [label];
  let ok = true;
  for(let k in label) {
    if (!checkUpgradeSupported(label[k])) return false;
  }
  return true;
}

chores.dateToString = function(d) {
  return d.toISOString().replace(/[:-]/g, '').replace(/[T.]/g, '-');
}

chores.getValidator = function() {
  return store.validator = store.validator || new Validator(store.validatorOptions);
}

chores.validate = function(object, schema) {
  let result = this.getValidator().validate(object, schema);
  if (typeof result.ok === 'boolean') {
    result.valid = result.ok;
  }
  return result;
}

let checkUpgradeSupported = function(label) {
  if (store.upgradeDisabled.indexOf(label) >= 0) return false;
  if (constx.UPGRADE_ENABLED.indexOf(label) >= 0) return true;
  return (store.upgradeEnabled.indexOf(label) >= 0);
}

chores.argumentsToArray = function(args, l, r) {
  if (args && ((!Array.isArray(args) && args.length >= 0) || (Array.isArray(args) && (l>=0 || r>=0)))) {
    args = Array.prototype.slice.call(args, l || 0, args.length - (r || 0));
  };
  return args;
}

chores.extractObjectInfo = function(data, opts) {
  function detect(data, level=2) {
    if (typeof level !== "number" || level < 0) level = 0;
    let info = undefined;
    let type = typeof(data);
    switch(type) {
      case "boolean":
      case "number":
      case "string":
      case "symbol":
      case "function":
      case "undefined": {
        info = type;
        break;
      }
      case "object": {
        if (data === null) {
          info = "null";
        } else if (Array.isArray(data)) {
          info = [];
          if (level > 0) {
            for(let i in data) {
              info.push(detect(data[i], level - 1));
            }
          }
        } else {
          info = {};
          if (level > 0) {
            for(let field in data) {
              info[field] = detect(data[field], level - 1);
            }
          }
        }
        break;
      }
    }
    return info;
  }
  return detect(data, opts && opts.level);
}

module.exports = chores;
