'use strict';

var lodash = require('lodash');
var path = require('path');
var LogTracer = require('logolite').LogTracer;
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var errorHandler = require('./error-handler').instance;

var LoggingWrapper = require('./logging-wrapper');
var loggingWrapper = new LoggingWrapper(chores.getBlockRef(__filename));
var LX = loggingWrapper.getLogger();
var LT = loggingWrapper.getTracer();

function PluginLoader(params) {
  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  params = params || {};

  var pluginRootDirs = lodash.map(params.pluginRefs, function(pluginRef) {
    pluginRef.pathDir = path.dirname(pluginRef.path);
    return pluginRef;
  });

  LX.has('conlog') && LX.log('conlog', ' - pluginRootDirs: %s', JSON.stringify(pluginRootDirs, null, 2));

  var loaderClass = {
    schemaValidator: params.schemaValidator
  };

  this.loadCommands = function(commandMap, commandContext) {
    return loadAllScripts.call(loaderClass, commandMap, 'COMMAND', commandContext, pluginRootDirs.filter(function(def) {
      return ['application', 'framework'].indexOf(def.type) >= 0;
    }));
  };

  this.loadRunhooks = function(runhookMap, runhookContext) {
    return loadAllScripts.call(loaderClass, runhookMap, 'RUNHOOK', runhookContext, pluginRootDirs);
  };

  this.loadServices = function(serviceMap) {
    return loadAllGadgets.call(loaderClass, serviceMap, 'SERVICE', pluginRootDirs);
  };

  this.loadTriggers = function(triggerMap) {
    return loadAllGadgets.call(loaderClass, triggerMap, 'TRIGGER', pluginRootDirs);
  };

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

PluginLoader.argumentSchema = {
  "id": "pluginLoader",
  "type": "object",
  "properties": {
    "pluginRefs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "path": {
            "type": "string"
          }
        }
      }
    },
    "schemaValidator": {
      "type": "object"
    }
  }
};

var hasSeparatedDir = function(scriptType) {
  return lodash.filter(constx, function(obj, key) {
    // return ['COMMAND', 'RUNHOOK', 'SERVICE', 'TRIGGER'].indexOf(key) >= 0;
    return obj.ROOT_KEY && obj.SCRIPT_DIR;
  }).filter(function(info) {
    return info.ROOT_KEY !== constx[scriptType].ROOT_KEY &&
        info.SCRIPT_DIR === constx[scriptType].SCRIPT_DIR;
  }).length === 0;
}

var getFilterPattern = function(scriptType) {
  return hasSeparatedDir(scriptType) ? '.*\.js' : constx[scriptType].ROOT_KEY + '_.*\.js';
}

var loadAllScripts = function(scriptMap, scriptType, scriptContext, pluginRootDirs) {
  var self = this;
  scriptMap = scriptMap || {};

  if (['COMMAND', 'RUNHOOK'].indexOf(scriptType) < 0) return scriptMap;

  var scriptSubDir = constx[scriptType].SCRIPT_DIR;

  pluginRootDirs.forEach(function(pluginRootDir) {
    loadScriptEntries.call(self, scriptMap, scriptType, scriptSubDir, scriptContext, pluginRootDir);
  });

  return scriptMap;
};

var loadScriptEntries = function(scriptMap, scriptType, scriptSubDir, scriptContext, pluginRootDir) {
  var self = this;

  var scriptFolder = pluginRootDir.pathDir + scriptSubDir;
  LX.has('conlog') && LX.log('conlog', ' - load %ss from folder: %s', constx[scriptType].ROOT_KEY, scriptFolder);

  var scriptFiles = chores.filterFiles(scriptFolder, getFilterPattern(scriptType));
  scriptFiles.forEach(function(scriptFile) {
    loadScriptEntry.call(self, scriptMap, scriptType, scriptSubDir, scriptFile, scriptContext, pluginRootDir);
  });
};

var loadScriptEntry = function(scriptMap, scriptType, scriptSubDir, scriptFile, scriptContext, pluginRootDir) {
  var self = this;
  var opStatus = lodash.assign({ type: scriptType, file: scriptFile, subDir: scriptSubDir }, pluginRootDir);
  var filepath = path.join(pluginRootDir.pathDir, scriptSubDir, scriptFile);
  try {
    var scriptInit = loader(filepath, { stopWhenError: true });
    if (lodash.isFunction(scriptInit)) {
      LX.has('conlog') && LX.log('conlog', ' - script file %s is ok', filepath);
      var target = scriptInit(scriptContext);
      var output = validateScript.call(self, target, scriptType);
      if (!output.valid) {
        LX.has('conlog') && LX.log('conlog', ' - script validation is failed: %s', JSON.stringify(output));
        opStatus.hasError = true;
      } else {
        LX.has('conlog') && LX.log('conlog', ' - script validation has been passed');
        if (target.enabled !== false) {
          var entryPath = scriptFile.replace('.js', '').toLowerCase().split('_');
          if (entryPath.length > 0 && entryPath[0] !== constx[scriptType].ROOT_KEY) {
            entryPath.unshift(constx[scriptType].ROOT_KEY);
          }
          entryPath = entryPath.reverse();
          entryPath.unshift(target);
          var entry = lodash.reduce(entryPath, function(result, item) {
            var nestEntry = {};
            nestEntry[item] = result;
            return nestEntry;
          });
          lodash.defaultsDeep(scriptMap, entry);
        } else {
          opStatus.isSkipped = true;
        }
        opStatus.hasError = false;
      }
    } else {
      LX.has('conlog') && LX.log('conlog', ' - script file %s doesnot contain a function.', filepath);
      opStatus.hasError = true;
    }
  } catch (err) {
    LX.has('conlog') && LX.log('conlog', ' - script file %s loading has failed.', filepath);
    opStatus.hasError = true;
    opStatus.stack = err.stack;
  }
  errorHandler.collect(opStatus);
};

var parseScriptTree = function(scriptName, scriptInstance, isHierarchical) {
  var entryPath = scriptName.toLowerCase().split('_');
  if (entryPath.length > 0 && entryPath[0] !== constx[scriptType].ROOT_KEY) {
    entryPath.unshift(constx[scriptType].ROOT_KEY);
  }
  entryPath = entryPath.reverse();
  entryPath.unshift(scriptInstance);
  var entry = lodash.reduce(entryPath, function(result, item) {
    var nestEntry = {};
    nestEntry[item] = result;
    return nestEntry;
  });
  return entry;
}

var validateScript = function(target, scriptType) {
  var self = this;
  target = target || {};
  var results = [];

  results.push(self.schemaValidator.validate(target, constx[scriptType].SCHEMA.OBJECT));

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

var loadAllGadgets = function(gadgetMap, gadgetType, pluginRootDirs) {
  var self = this;
  gadgetMap = gadgetMap || {};

  if (['SERVICE', 'TRIGGER'].indexOf(gadgetType) < 0) return gadgetMap;

  var gadgetSubDir = constx[gadgetType].SCRIPT_DIR;

  pluginRootDirs.forEach(function(pluginRootDir) {
    pluginRootDir.code = chores.stringCamelCase(pluginRootDir.name);
    loadGadgetEntries.call(self, gadgetMap, gadgetType, gadgetSubDir, pluginRootDir);
  });

  return gadgetMap;
};

var loadGadgetEntries = function(gadgetMap, gadgetType, gadgetSubDir, pluginRootDir) {
  var self = this;

  var gadgetFolder = pluginRootDir.pathDir + gadgetSubDir;
  LX.has('conlog') && LX.log('conlog', ' - load %ss from folder: %s', constx[gadgetType].ROOT_KEY, gadgetFolder);

  var gadgetFiles = chores.filterFiles(gadgetFolder, getFilterPattern(gadgetType));
  gadgetFiles.forEach(function(gadgetFile) {
    loadGadgetEntry.call(self, gadgetMap, gadgetType, gadgetSubDir, gadgetFile, pluginRootDir);
  });
};

var loadGadgetEntry = function(gadgetMap, gadgetType, gadgetSubDir, gadgetFile, pluginRootDir) {
  var self = this;
  var opStatus = lodash.assign({ type: gadgetType, file: gadgetFile, subDir: gadgetSubDir }, pluginRootDir);
  var filepath = path.join(pluginRootDir.pathDir, gadgetSubDir, gadgetFile);
  try {
    var gadgetConstructor = loader(filepath, { stopWhenError: true });
    LX.has('conlog') && LX.log('conlog', ' - gadget file %s loading has done', filepath);
    if (lodash.isFunction(gadgetConstructor)) {
      var gadgetName = chores.stringCamelCase(gadgetFile.replace('.js', ''));
      lodash.defaults(gadgetMap, buildGadgetWrapper(gadgetConstructor, gadgetName, pluginRootDir));
      opStatus.hasError = false;
    } else {
      LX.has('conlog') && LX.log('conlog', ' - gadget file %s doesnot contain a function', filepath);
      opStatus.hasError = true;
    }
  } catch(err) {
    LX.has('conlog') && LX.log('conlog', ' - gadget file %s loading has failed', filepath);
    opStatus.hasError = true;
    opStatus.stack = err.stack;
  }
  errorHandler.collect(opStatus);
};

var specialPlugins = ['application', 'devebot'];

var buildGadgetWrapper = function(gadgetConstructor, wrapperName, pluginRootDir) {
  var result = {};

  if (!lodash.isFunction(gadgetConstructor)) {
    LX.has('conlog') && LX.log('conlog', ' - gadgetConstructor is invalid');
    return result;
  }

  var uniqueName = [pluginRootDir.name, wrapperName].join(chores.getSeparator());

  var pluginName = pluginRootDir.code;
  if (specialPlugins.indexOf(pluginRootDir.type) >= 0) {
    pluginName = pluginRootDir.type;
  }

  function wrapperConstructor(params) {
    params = params || {};
    var isWrapped = false;
    var getWrappedParams = function() {
      if (isWrapped) return params;
      isWrapped = true;
      return params = lodash.clone(params);
    }
    var newFeatures = lodash.get(params, ['profileConfig', 'newFeatures', pluginName], {});
    LX.has('conlog') && LX.log('conlog', ' - newFeatures[%s]: %s', pluginName, JSON.stringify(newFeatures));
    if (newFeatures.sandboxConfig) {
      params = getWrappedParams();
      if (specialPlugins.indexOf(pluginRootDir.type) >= 0) {
        params.sandboxConfig = lodash.get(params, ['sandboxConfig', pluginName], {});
      } else {
        params.sandboxConfig = lodash.get(params, ['sandboxConfig', 'plugins', pluginName], {});
      }
    }
    // wrap getLogger() and add getTracer()
    if (newFeatures.logoliteEnabled) {
      params = getWrappedParams();
      params.loggingFactory = params.loggingFactory.branch(uniqueName);
    }
    gadgetConstructor.call(this, params);
  }

  wrapperConstructor.prototype = Object.create(gadgetConstructor.prototype);

  var wrappedArgumentSchema = {
    "id": wrapperName,
    "type": "object",
    "properties": {
      "sandboxName": {
        "type": "string"
      },
      "sandboxConfig": {
        "type": "object"
      },
      "profileConfig": {
        "type": "object"
      },
      "loggingFactory": {
        "type": "object"
      }
    }
  }

  var wrappedArgumentFields = ["sandboxName", "sandboxConfig", "profileConfig", "loggingFactory"];

  if (gadgetConstructor.argumentSchema) {
    wrapperConstructor.argumentSchema = lodash.merge(wrappedArgumentSchema, gadgetConstructor.argumentSchema);
  } else {
    var referenceList = gadgetConstructor.referenceList || [];
    wrapperConstructor.argumentProperties = undefined && wrappedArgumentFields.concat(referenceList);
    lodash.forEach(referenceList, function(refName) {
      wrappedArgumentSchema.properties[refName] = wrappedArgumentSchema.properties[refName] || {type: "object"};
    });
    wrapperConstructor.argumentSchema = wrappedArgumentSchema;
  }

  LX.has('conlog') && LX.log('conlog', ' - argumentSchema: %s', JSON.stringify(wrapperConstructor.argumentSchema));

  result[uniqueName] = {
    moduleId: pluginRootDir.name,
    name: wrapperName,
    construktor: wrapperConstructor
  };

  LX.has('conlog') && LX.log('conlog', ' - build gadget wrapper (%s) has done.', wrapperName);

  return result;
};

module.exports = PluginLoader;
