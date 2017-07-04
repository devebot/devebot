'use strict';

var lodash = require('lodash');
var path = require('path');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var debug = require('../utils/debug.js');
var debugx = debug('devebot:pluginLoader');

function PluginLoader(params) {
  debugx.enabled && debugx(' + constructor start ...');

  params = params || {};

  var pluginRootDirs = lodash.map(params.pluginRefs, function(pluginRef) {
    pluginRef.pathDir = path.dirname(pluginRef.path);
    return pluginRef;
  });

  debugx.enabled && debugx(' - pluginRootDirs: %s', JSON.stringify(pluginRootDirs, null, 2));

  var loaderClass = { contextMonitor: params.contextMonitor };

  this.loadCommands = function(commandMap, commandContext) {
    return loadAllScripts.call(loaderClass, commandMap, 'COMMAND', pluginRootDirs.filter(function(def) {
      return ['application', 'framework'].indexOf(def.type) >= 0;
    }), commandContext);
  };

  this.loadRunhooks = function(runhookMap, runhookContext) {
    return loadAllScripts.call(loaderClass, runhookMap, 'RUNHOOK', pluginRootDirs, runhookContext);
  };

  this.loadServices = function(serviceMap) {
    return loadAllGadgets.call(loaderClass, serviceMap, 'SERVICE', pluginRootDirs);
  };

  this.loadTriggers = function(triggerMap) {
    return loadAllGadgets.call(loaderClass, triggerMap, 'TRIGGER', pluginRootDirs);
  };

  debugx.enabled && debugx(' - constructor has finished');
}

PluginLoader.argumentSchema = {
  "id": "pluginLoader",
  "type": "object",
  "properties": {
    "contextMonitor": {
      "type": "object"
    },
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

var loadAllScripts = function(scriptMap, scriptType, scriptRootDirs, scriptContext) {
  var self = this;
  scriptMap = scriptMap || {};

  if (['COMMAND', 'RUNHOOK'].indexOf(scriptType) < 0) return scriptMap;

  var scriptSubDir = constx[scriptType].SCRIPT_DIR;

  scriptRootDirs.forEach(function(scriptRootDir) {
    loadScriptEntries.call(self, scriptMap, scriptType, scriptRootDir, scriptSubDir, scriptContext);
  });

  return scriptMap;
};

var loadScriptEntries = function(scriptMap, scriptType, scriptRootDir, scriptSubDir, scriptContext) {
  var self = this;

  var scriptFolder = scriptRootDir.pathDir + scriptSubDir;
  debugx.enabled && debugx(' - load %ss from folder: %s', constx[scriptType].ROOT_KEY, scriptFolder);

  var scriptFiles = chores.filterFiles(scriptFolder, getFilterPattern(scriptType));
  scriptFiles.forEach(function(scriptFile) {
    loadScriptEntry.call(self, scriptMap, scriptType, scriptRootDir, scriptSubDir, scriptFile, scriptContext);
  });
};

var loadScriptEntry = function(scriptMap, scriptType, scriptRootDir, scriptSubDir, scriptFile, scriptContext) {
  var self = this;
  var opStatus = lodash.assign({ type: scriptType, file: scriptFile, subDir: scriptSubDir }, scriptRootDir);
  var filepath = path.join(scriptRootDir.pathDir, scriptSubDir, scriptFile);
  var scriptInit = loader(filepath);
  if (lodash.isFunction(scriptInit)) {
    var target = scriptInit(scriptContext);
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
    debugx.enabled && debugx(' - script file %s is ok', filepath);
    opStatus.hasError = false;
  } else {
    debugx.enabled && debugx(' - script file %s doesnot contain a function.', filepath);
    opStatus.hasError = true;
  }
  self.contextMonitor.collect(opStatus);
};

var loadAllGadgets = function(gadgetMap, gadgetType, pluginRootDirs) {
  var self = this;
  gadgetMap = gadgetMap || {};

  if (['SERVICE', 'TRIGGER'].indexOf(gadgetType) < 0) return gadgetMap;

  var gadgetSubDir = constx[gadgetType].SCRIPT_DIR;

  pluginRootDirs.forEach(function(pluginRootDir) {
    loadGadgetEntries.call(self, gadgetMap, gadgetType, pluginRootDir, gadgetSubDir);
  });

  return gadgetMap;
};

var loadGadgetEntries = function(gadgetMap, gadgetType, pluginRootDir, gadgetSubDir) {
  var self = this;

  var gadgetFolder = pluginRootDir.pathDir + gadgetSubDir;
  debugx.enabled && debugx(' - load %ss from folder: %s', constx[gadgetType].ROOT_KEY, gadgetFolder);

  var gadgetFiles = chores.filterFiles(gadgetFolder, getFilterPattern(gadgetType));
  gadgetFiles.forEach(function(gadgetFile) {
    loadGadgetEntry.call(self, gadgetMap, gadgetType, pluginRootDir, gadgetSubDir, gadgetFile);
  });
};

var loadGadgetEntry = function(gadgetMap, gadgetType, pluginRootDir, gadgetSubDir, gadgetFile) {
  var self = this;
  var opStatus = lodash.assign({ type: gadgetType, file: gadgetFile, subDir: gadgetSubDir }, pluginRootDir);
  var filepath = path.join(pluginRootDir.pathDir, gadgetSubDir, gadgetFile);
  var gadgetConstructor = loader(filepath);
  if (lodash.isFunction(gadgetConstructor)) {
    var gadgetName = gadgetFile.replace('.js', '').replace(/-([a-z])/g, function (m, w) {
      return w.toUpperCase();
    });
    lodash.defaults(gadgetMap, buildGadgetWrapper(gadgetConstructor, gadgetName));
    opStatus.hasError = false;
  } else {
    opStatus.hasError = true;
  }
  self.contextMonitor.collect(opStatus);
};

var buildGadgetWrapper = function(gadgetConstructor, wrapperName) {
  var result = {};

  if (!lodash.isFunction(gadgetConstructor)) {
    debugx.enabled && debugx(' - gadgetConstructor is invalid');
    return result;
  }

  function wrapperConstructor(params) {
    params = params || {};
    //params.sandboxConfig = lodash.get(params, ['sandboxConfig', 'plugins', wrapperName], {});
    gadgetConstructor.call(this, params);
  }

  wrapperConstructor.prototype = Object.create(gadgetConstructor.prototype);

  wrapperConstructor.argumentSchema = gadgetConstructor.argumentSchema;

  result[wrapperName] = wrapperConstructor;

  debugx.enabled && debugx(' - build gadget wrapper (%s) has done.', wrapperName);

  return result;
};

module.exports = PluginLoader;
