'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var lodash = require('lodash');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var debug = require('../utils/debug.js');
var debuglog = debug('devebot:pluginLoader');

function PluginLoader(params) {
  debuglog(' + constructor start ...');
  PluginLoader.super_.apply(this);

  params = params || {};

  if (debuglog.isEnabled) {
    debuglog(' - pluginLoader start with pluginRootDirs: %s', JSON.stringify(params.pluginRootDirs, null, 2));
  }

  this.loadCommands = function(commandMap, commandContext) {
    return loadAllScripts(commandMap, constx.COMMAND.ROOT_KEY, params.pluginRootDirs, commandContext);
  };

  this.loadRunhooks = function(runhookMap, runhookContext) {
    return loadAllScripts(runhookMap, constx.RUNHOOK.ROOT_KEY, params.pluginRootDirs, runhookContext);
  };

  this.loadServices = function(serviceMap) {
    return loadAllGadgets(serviceMap, constx.SERVICE.ROOT_KEY, params.pluginRootDirs);
  };

  this.loadTriggers = function(triggerMap) {
    return loadAllGadgets(triggerMap, constx.TRIGGER.ROOT_KEY, params.pluginRootDirs);
  };

  debuglog(' - constructor has finished');
}

PluginLoader.argumentSchema = {
  "id": "pluginLoader",
  "type": "object",
  "properties": {
    "pluginNames": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "pluginRootDirs": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
};

var loadAllScripts = function(scriptMap, scriptType, scriptRootDirs, scriptContext) {
  var self = this;
  scriptMap = scriptMap || {};
  
  if (['command', 'runhook'].indexOf(scriptType) < 0) return scriptMap;

  var scriptSubDir = constx[scriptType.toUpperCase()].SCRIPT_DIR;

  scriptRootDirs.forEach(function(scriptRootDir) {
    loadScriptEntries.call(self, scriptMap, scriptRootDir + scriptSubDir, scriptType, scriptContext);
  });

  return scriptMap;
};

var loadScriptEntries = function(scriptMap, scriptFolder, scriptKey, scriptContext) {
  var self = this;
  
  if (debuglog.isEnabled) {
    debuglog(' - load %ss from folder: %s', scriptKey, scriptFolder);
  }

  var scriptFiles = chores.filterFiles(scriptFolder, scriptKey);
  scriptFiles.forEach(function(scriptFile) {
    loadScriptEntry.call(self, scriptMap, scriptFolder, scriptFile, scriptContext);
  });
};

var loadScriptEntry = function(scriptMap, scriptFolder, scriptFile, scriptContext) {
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

var loadAllGadgets = function(gadgetMap, gadgetType, pluginRootDirs) {
  var self = this;
  gadgetMap = gadgetMap || {};

  if (['service', 'trigger'].indexOf(gadgetType) < 0) return gadgetMap;
  
  var gadgetSubDir = constx[gadgetType.toUpperCase()].SCRIPT_DIR;
  
  pluginRootDirs.forEach(function(pluginRootDir) {
    loadGadgetEntries.call(self, gadgetMap, gadgetType, pluginRootDir + gadgetSubDir);
  });
  
  return gadgetMap;
};

var loadGadgetEntries = function(gadgetMap, gadgetType, gadgetFolder) {
  var self = this;
  
  if (debuglog.isEnabled) {
    debuglog(' - load %ss from folder: %s', gadgetType, gadgetFolder);
  }

  var gadgetFiles = chores.filterFiles(gadgetFolder, '.*\.js');
  gadgetFiles.forEach(function(gadgetFile) {
    loadGadgetEntry.call(self, gadgetMap, gadgetFolder, gadgetFile);
  });
};

var loadGadgetEntry = function(gadgetMap, gadgetFolder, gadgetFile) {
  var filepath = path.join(gadgetFolder, gadgetFile);
  var gadgetConstructor = loader(filepath);
  if (lodash.isFunction(gadgetConstructor)) {
    var gadgetName = gadgetFile.replace('.js', '').replace(/-([a-z])/g, function (m, w) {
      return w.toUpperCase();
    });
    lodash.defaults(gadgetMap, buildGadgetWrapper(gadgetConstructor, gadgetName));
  }
};

var buildGadgetWrapper = function(gadgetConstructor, wrapperName) {
  var result = {};

  if (!lodash.isFunction(gadgetConstructor)) {
    debuglog(' - gadgetConstructor is invalid');
    return result;
  }

  function wrapperConstructor(params) {
    params = params || {};
    //params.sandboxconfig = lodash.get(params, ['sandboxconfig', 'plugins', wrapperName], {});
    gadgetConstructor.call(this, params);
  }

  wrapperConstructor.prototype = Object.create(gadgetConstructor.prototype);
  
  wrapperConstructor.argumentSchema = gadgetConstructor.argumentSchema;

  result[wrapperName] = wrapperConstructor;

  if (debuglog.isEnabled) {
    debuglog(' - build gadget wrapper (%s) has done.', wrapperName);
  }

  return result;
};

util.inherits(PluginLoader, events.EventEmitter);

module.exports = PluginLoader;
