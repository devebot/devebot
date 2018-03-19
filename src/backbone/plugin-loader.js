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

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [blockRef, 'constructor-begin'],
    text: ' + constructor start ...'
  }));

  var pluginRootDirs = lodash.map(params.pluginRefs, function(pluginRef) {
    pluginRef.code = pluginRef.code || chores.stringCamelCase(pluginRef.name);
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

  this.loadSchemas = function(schemaMap) {
    return loadAllSchemas.call(loaderClass, schemaMap, pluginRootDirs);
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
      // return ['ROUTINE', 'SCHEMA', 'SERVICE', 'TRIGGER'].indexOf(key) >= 0;
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
            moduleId: pluginName,
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

  var loadAllSchemas = function(schemaMap, pluginRootDirs) {
    var self = this;
    var schemaType = 'SCHEMA';
    schemaMap = schemaMap || {};
    var schemaSubDir = constx[schemaType].SCRIPT_DIR;
    pluginRootDirs.forEach(function(pluginRootDir) {
      loadSchemaEntries.call(self, schemaMap, schemaSubDir, pluginRootDir);
    });
    return schemaMap;
  }

  var loadSchemaEntries = function(schemaMap, schemaSubDir, pluginRootDir) {
    var self = this;
    var schemaType = 'SCHEMA';
    var schemaFolder = pluginRootDir.pathDir + schemaSubDir;
    LX.has('conlog') && LX.log('conlog', LT.add({
      schemaKey: constx[schemaType].ROOT_KEY,
      schemaFolder: schemaFolder
    }).toMessage({
      text: ' - load ${schemaKey}s from folder: ${schemaFolder}'
    }));
    var schemaFiles = chores.filterFiles(schemaFolder, getFilterPattern(schemaType));
    schemaFiles.forEach(function(schemaFile) {
      loadSchemaEntry.call(self, schemaMap, schemaSubDir, schemaFile, pluginRootDir);
    });
  }

  var loadSchemaEntry = function(schemaMap, schemaSubDir, schemaFile, pluginRootDir) {
    var self = this;
    var schemaType = 'SCHEMA';
    var opStatus = lodash.assign({ type: 'SCHEMA', file: schemaFile, subDir: schemaSubDir }, pluginRootDir);
    var filepath = path.join(pluginRootDir.pathDir, schemaSubDir, schemaFile);
    try {
      var schemaObject = loader(filepath, { stopWhenError: true });
      var output = validateSchema.call(self, schemaObject, schemaType);
      if (!output.valid) {
        LX.has('conlog') && LX.log('conlog', LT.add({
          validationResult: output
        }).toMessage({
          text: ' - validating schema fail: ${validationResult}'
        }));
        opStatus.hasError = true;
      } else if (schemaObject.enabled === false) {
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
        var typeName = schemaObject.type || schemaFile.replace('.js', '').toLowerCase();
        var subtypeName = schemaObject.subtype || 'default';
        var uniqueName = [pluginRootDir.name, typeName].join(chores.getSeparator());
        var entry = {};
        entry[uniqueName] = entry[uniqueName] || {};
        entry[uniqueName][subtypeName] = {
          moduleId: getPluginRefByName(pluginRootDir),
          pluginCode: getPluginRefByCode(pluginRootDir),
          type: typeName,
          subtype: subtypeName,
          schema: schemaObject.schema
        };
        lodash.defaultsDeep(schemaMap, entry);
      }
    } catch(err) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        filepath: filepath
      }).toMessage({
        text: ' - schema file ${filepath} loading has failed'
      }));
      LX.has('conlog') && console.log(err);
      opStatus.hasError = true;
      opStatus.stack = err.stack;
    }
    errorHandler.collect(opStatus);
  }

  var validateSchema = function(schemaObject) {
    var self = this;
    var schemaType = 'SCHEMA';
    schemaObject = schemaObject || {};
    var results = [];
    results.push(self.schemaValidator.validate(schemaObject, constx[schemaType].SCHEMA_OBJECT));
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
      LX.has('conlog') && console.log(err);
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
      moduleId: pluginName,
      name: wrapperName,
      construktor: wrapperConstructor
    };

    LX.has('conlog') && LX.log('conlog', LT.add({
      uniqueName: uniqueName,
      moduleId: pluginName,
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
