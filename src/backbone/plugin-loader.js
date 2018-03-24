'use strict';

var lodash = require('lodash');
var path = require('path');
var LogTracer = require('logolite').LogTracer;
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var loader = require('../utils/loader.js');
var errorHandler = require('./error-handler').instance;

function PluginLoader(params) {
  params = params || {};

  var blockRef = chores.getBlockRef(__filename);
  var loggingFactory = params.loggingFactory.branch(blockRef);
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();
  var CTX = {LX, LT};

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [blockRef, 'constructor-begin'],
    text: ' + constructor start ...'
  }));

  const PLUGIN_NAME_PATTERNS = [
    /^devebot-dp-([a-z][a-zA-Z0-9_\-]*)$/g,
    /^([a-z][a-zA-Z0-9_\-]*)$/g
  ];

  let extractPluginCode = function(CTX, pluginRef) {
    let info = chores.extractCodeByPattern(CTX, PLUGIN_NAME_PATTERNS, pluginRef.name);
    if (info.i < 0) {
      errorHandler.collect(lodash.assign({
        stage: 'naming',
        type: 'plugin',
        hasError: true,
        stack: PLUGIN_NAME_PATTERNS.toString()
      }, pluginRef));
    }
    return info.code;
  }

  var pluginRootDirs = lodash.map(params.pluginRefs, function(pluginRef) {
    pluginRef.code = pluginRef.code || extractPluginCode(CTX, pluginRef);
    pluginRef.pathDir = path.dirname(pluginRef.path);
    return pluginRef;
  });

  LX.has('conlog') && LX.log('conlog', LT.add({
    pluginRootDirs: pluginRootDirs
  }).toMessage({
    text: ' - pluginRootDirs: ${pluginRootDirs}'
  }));

  var loaderClass = {
    schemaValidator: params.schemaValidator
  };

  this.loadMetadata = function(metadataMap) {
    return loadAllMetainfs.call(loaderClass, metadataMap, pluginRootDirs);
  }

  this.loadRoutines = function(routineMap, routineContext) {
    return loadAllScripts.call(loaderClass, routineMap, 'ROUTINE', routineContext, pluginRootDirs);
  };

  this.loadServices = function(serviceMap) {
    return loadAllGadgets.call(loaderClass, serviceMap, 'SERVICE', pluginRootDirs);
  };

  this.loadTriggers = function(triggerMap) {
    return loadAllGadgets.call(loaderClass, triggerMap, 'TRIGGER', pluginRootDirs);
  };

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  var hasSeparatedDir = function(scriptType) {
    return lodash.filter(constx, function(obj, key) {
      // return ['METAINF', 'ROUTINE', 'SERVICE', 'TRIGGER'].indexOf(key) >= 0;
      return obj.ROOT_KEY && obj.SCRIPT_DIR;
    }).filter(function(info) {
      return info.ROOT_KEY !== constx[scriptType].ROOT_KEY &&
          info.SCRIPT_DIR === constx[scriptType].SCRIPT_DIR;
    }).length === 0;
  }

  var getFilterPattern = function(scriptType) {
    return hasSeparatedDir(scriptType) ? '.*\.js' : constx[scriptType].ROOT_KEY + '_.*\.js';
  }

  var getPluginRefByName = chores.getPluginRefBy.bind(chores, 'name');
  var getPluginRefByCode = chores.getPluginRefBy.bind(chores, 'code');

  var loadAllScripts = function(scriptMap, scriptType, scriptContext, pluginRootDirs) {
    var self = this;
    scriptMap = scriptMap || {};

    if (scriptType !== 'ROUTINE') return scriptMap;

    var scriptSubDir = constx[scriptType].SCRIPT_DIR;

    pluginRootDirs.forEach(function(pluginRootDir) {
      loadScriptEntries.call(self, scriptMap, scriptType, scriptSubDir, scriptContext, pluginRootDir);
    });

    return scriptMap;
  };

  var loadScriptEntries = function(scriptMap, scriptType, scriptSubDir, scriptContext, pluginRootDir) {
    var self = this;

    var scriptFolder = pluginRootDir.pathDir + scriptSubDir;
    LX.has('conlog') && LX.log('conlog', LT.add({
      scriptKey: constx[scriptType].ROOT_KEY,
      scriptFolder: scriptFolder
    }).toMessage({
      text: ' - load ${scriptKey}s from folder: ${scriptFolder}'
    }));

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
        LX.has('conlog') && LX.log('conlog', LT.add({
          filepath: filepath
        }).toMessage({
          text: ' - script file ${filepath} is ok'
        }));
        var scriptObject = scriptInit(scriptContext);
        var output = validateScript.call(self, scriptObject, scriptType);
        if (!output.valid) {
          LX.has('conlog') && LX.log('conlog', LT.add({
            validationResult: output
          }).toMessage({
            text: ' - validating script fail: ${validationResult}'
          }));
          opStatus.hasError = true;
        } else if (scriptObject.enabled === false) {
          LX.has('conlog') && LX.log('conlog', LT.toMessage({
            text: ' - script is disabled'
          }));
          opStatus.hasError = false;
          opStatus.isSkipped = true;
        } else {
          LX.has('conlog') && LX.log('conlog', LT.toMessage({
            text: ' - script validation pass'
          }));
          opStatus.hasError = false;
          var scriptName = scriptFile.replace('.js', '').toLowerCase();
          var uniqueName = [pluginRootDir.name, scriptName].join(chores.getSeparator());
          var pluginName = getPluginRefByName(pluginRootDir);
          var entry = {};
          entry[uniqueName] = {
            crateScope: pluginName,
            name: scriptName,
            object: scriptObject
          };
          lodash.defaultsDeep(scriptMap, entry);
        }
      } else {
        LX.has('conlog') && LX.log('conlog', LT.add({
          filepath: filepath
        }).toMessage({
          text: ' - script file ${filepath} doesnot contain a function.'
        }));
        opStatus.hasError = true;
      }
    } catch (err) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        filepath: filepath
      }).toMessage({
        text: ' - script file ${filepath} loading has failed.'
      }));
      opStatus.hasError = true;
      opStatus.stack = err.stack;
    }
    errorHandler.collect(opStatus);
  };

  var parseScriptTree = function(scriptFile, scriptInstance, isHierarchical) {
    var entryPath = scriptFile.replace('.js', '').toLowerCase().split('_');
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

  var validateScript = function(scriptObject, scriptType) {
    var self = this;
    scriptObject = scriptObject || {};
    var results = [];

    results.push(self.schemaValidator.validate(scriptObject, constx[scriptType].SCHEMA_OBJECT));

    if (!lodash.isFunction(scriptObject.handler)) {
      results.push({
        valid: false,
        errors: [{
          message: 'handler has wrong type: ' + typeof(scriptObject.handler)
        }]
      });
    }

    return results.reduce(function(output, result) {
      output.valid = output.valid && (result.valid != false);
      output.errors = output.errors.concat(result.errors);
      return output;
    }, { valid: true, errors: [] });
  };

  var loadAllMetainfs = function(metainfMap, pluginRootDirs) {
    var self = this;
    var metainfType = 'METAINF';
    metainfMap = metainfMap || {};
    var metainfSubDir = constx[metainfType].SCRIPT_DIR;
    pluginRootDirs.forEach(function(pluginRootDir) {
      loadMetainfEntries.call(self, metainfMap, metainfSubDir, pluginRootDir);
    });
    return metainfMap;
  }

  var loadMetainfEntries = function(metainfMap, metainfSubDir, pluginRootDir) {
    var self = this;
    var metainfType = 'METAINF';
    var metainfFolder = pluginRootDir.pathDir + metainfSubDir;
    LX.has('conlog') && LX.log('conlog', LT.add({
      metainfKey: constx[metainfType].ROOT_KEY,
      metainfFolder: metainfFolder
    }).toMessage({
      text: ' - load ${metainfKey}s from folder: ${metainfFolder}'
    }));
    var schemaFiles = chores.filterFiles(metainfFolder, getFilterPattern(metainfType));
    schemaFiles.forEach(function(schemaFile) {
      loadMetainfEntry.call(self, metainfMap, metainfSubDir, schemaFile, pluginRootDir);
    });
  }

  var loadMetainfEntry = function(metainfMap, metainfSubDir, schemaFile, pluginRootDir) {
    var self = this;
    var metainfType = 'METAINF';
    var opStatus = lodash.assign({ type: 'METAINF', file: schemaFile, subDir: metainfSubDir }, pluginRootDir);
    var filepath = path.join(pluginRootDir.pathDir, metainfSubDir, schemaFile);
    try {
      var metainfObject = loader(filepath, { stopWhenError: true });
      var output = validateMetainf.call(self, metainfObject, metainfType);
      if (!output.valid) {
        LX.has('conlog') && LX.log('conlog', LT.add({
          validationResult: output
        }).toMessage({
          text: ' - validating schema fail: ${validationResult}'
        }));
        opStatus.hasError = true;
      } else if (metainfObject.enabled === false) {
        LX.has('conlog') && LX.log('conlog', LT.toMessage({
          text: ' - schema is disabled'
        }));
        opStatus.hasError = false;
        opStatus.isSkipped = true;
      } else {
        LX.has('conlog') && LX.log('conlog', LT.toMessage({
          text: ' - schema validation pass'
        }));
        opStatus.hasError = false;
        var typeName = metainfObject.type || schemaFile.replace('.js', '').toLowerCase();
        var subtypeName = metainfObject.subtype || 'default';
        var uniqueName = [pluginRootDir.name, typeName].join(chores.getSeparator());
        var entry = {};
        entry[uniqueName] = entry[uniqueName] || {};
        entry[uniqueName][subtypeName] = {
          crateScope: getPluginRefByName(pluginRootDir),
          pluginCode: getPluginRefByCode(pluginRootDir),
          type: typeName,
          subtype: subtypeName,
          schema: metainfObject.schema
        };
        lodash.defaultsDeep(metainfMap, entry);
      }
    } catch(err) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        filepath: filepath
      }).toMessage({
        text: ' - schema file ${filepath} loading has failed'
      }));
      LX.has('conlog') && chores.printError(err);
      opStatus.hasError = true;
      opStatus.stack = err.stack;
    }
    errorHandler.collect(opStatus);
  }

  var validateMetainf = function(metainfObject) {
    var self = this;
    var metainfType = 'METAINF';
    metainfObject = metainfObject || {};
    var results = [];
    results.push(self.schemaValidator.validate(metainfObject, constx[metainfType].SCHEMA_OBJECT));
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
    LX.has('conlog') && LX.log('conlog', LT.add({
      gadgetKey: constx[gadgetType].ROOT_KEY,
      gadgetFolder: gadgetFolder
    }).toMessage({
      text: ' - load ${gadgetKey}s from folder: ${gadgetFolder}'
    }));

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
      LX.has('conlog') && LX.log('conlog', LT.add({
        filepath: filepath
      }).toMessage({
        text: ' - gadget file ${filepath} loading has done'
      }));
      if (lodash.isFunction(gadgetConstructor)) {
        var gadgetName = chores.stringCamelCase(gadgetFile.replace('.js', ''));
        lodash.defaults(gadgetMap, buildGadgetWrapper(gadgetConstructor, gadgetName, pluginRootDir));
        opStatus.hasError = false;
      } else {
        LX.has('conlog') && LX.log('conlog', LT.add({
          filepath: filepath
        }).toMessage({
          text: ' - gadget file ${filepath} doesnot contain a function'
        }));
        opStatus.hasError = true;
      }
    } catch(err) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        filepath: filepath
      }).toMessage({
        text: ' - gadget file ${filepath} loading has failed'
      }));
      LX.has('conlog') && chores.printError(err);
      opStatus.hasError = true;
      opStatus.stack = err.stack;
    }
    errorHandler.collect(opStatus);
  };

  var buildGadgetWrapper = function(gadgetConstructor, wrapperName, pluginRootDir) {
    var result = {};

    if (!lodash.isFunction(gadgetConstructor)) {
      LX.has('conlog') && LX.log('conlog', LT.toMessage({
        text: ' - gadgetConstructor is invalid'
      }));
      return result;
    }

    var pluginName = getPluginRefByName(pluginRootDir);
    var pluginCode = getPluginRefByCode(pluginRootDir);
    var uniqueName = [pluginRootDir.name, wrapperName].join(chores.getSeparator());

    function wrapperConstructor(kwargs) {
      kwargs = kwargs || {};
      var isWrapped = false;
      var getWrappedParams = function() {
        if (isWrapped) return kwargs;
        isWrapped = true;
        return kwargs = lodash.clone(kwargs);
      }
      var newFeatures = lodash.get(kwargs, ['profileConfig', 'newFeatures', pluginCode], {});
      LX.has('conlog') && LX.log('conlog', LT.add({
        pluginCode: pluginCode,
        newFeatures: newFeatures
      }).toMessage({
        text: ' - newFeatures[${pluginCode}]: ${newFeatures}'
      }));
      if (newFeatures.sandboxConfig) {
        kwargs = getWrappedParams();
        if (chores.isSpecialPlugin(pluginRootDir.type)) {
          kwargs.sandboxConfig = lodash.get(kwargs, ['sandboxConfig', pluginCode], {});
        } else {
          kwargs.sandboxConfig = lodash.get(kwargs, ['sandboxConfig', 'plugins', pluginCode], {});
        }
      }
      // wrap getLogger() and add getTracer()
      if (newFeatures.logoliteEnabled) {
        kwargs = getWrappedParams();
        kwargs.loggingFactory = kwargs.loggingFactory.branch(uniqueName);
      }
      gadgetConstructor.call(this, kwargs);
    }

    wrapperConstructor.prototype = Object.create(gadgetConstructor.prototype);

    var wrappedArgumentSchema = {
      "$id": wrapperName,
      "type": "object",
      "properties": {
        "sandboxName": {
          "type": "string"
        },
        "sandboxConfig": {
          "type": "object"
        },
        "profileName": {
          "type": "string"
        },
        "profileConfig": {
          "type": "object"
        },
        "loggingFactory": {
          "type": "object"
        }
      }
    }

    var wrappedArgumentFields = ["sandboxName", "sandboxConfig", "profileName", "profileConfig", "loggingFactory"];

    if (gadgetConstructor.argumentSchema) {
      wrapperConstructor.argumentSchema = lodash.merge(wrappedArgumentSchema, gadgetConstructor.argumentSchema);
    } else {
      var referenceList = gadgetConstructor.referenceList || [];
      if (!lodash.isEmpty(referenceList)) {
        wrapperConstructor.argumentProperties = wrappedArgumentFields.concat(referenceList);
      }
      lodash.forEach(referenceList, function(refName) {
        wrappedArgumentSchema.properties[refName] = wrappedArgumentSchema.properties[refName] || {type: "object"};
      });
      wrapperConstructor.argumentSchema = wrappedArgumentSchema;
    }

    LX.has('conlog') && LX.log('conlog', LT.add({
      argumentSchema: wrapperConstructor.argumentSchema
    }).toMessage({
      text: ' - wrapperConstructor.argumentSchema: ${argumentSchema}'
    }));

    result[uniqueName] = {
      crateScope: pluginName,
      name: wrapperName,
      construktor: wrapperConstructor
    };

    LX.has('conlog') && LX.log('conlog', LT.add({
      uniqueName: uniqueName,
      crateScope: pluginName,
      name: wrapperName
    }).toMessage({
      text: ' - build gadget wrapper (${name}) has done.'
    }));

    return result;
  };

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

PluginLoader.argumentSchema = {
  "$id": "pluginLoader",
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
    "loggingFactory": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    }
  }
};

module.exports = PluginLoader;
