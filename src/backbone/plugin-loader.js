'use strict';

const lodash = require('lodash');
const path = require('path');
const util = require('util');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const loader = require('../utils/loader');
const blockRef = chores.getBlockRef(__filename);

function PluginLoader(params={}) {
  let loggingFactory = params.loggingFactory.branch(blockRef);
  let L = loggingFactory.getLogger();
  let T = loggingFactory.getTracer();
  let CTX = lodash.assign({L, T}, lodash.pick(params, [
    'issueInspector','nameResolver', 'schemaValidator', 'objectDecorator'
  ]));

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [blockRef, 'constructor-begin'],
    text: ' + constructor start ...'
  }));

  lodash.forEach(params.pluginRefs, function(pluginRef) {
    pluginRef.pathDir = pluginRef.path;
    return pluginRef;
  });

  L.has('dunce') && L.log('dunce', T.add(params).toMessage({
    text: ' - pluginRefs: ${pluginRefs}'
  }));

  this.loadMetadata = function(metadataMap) {
    return loadAllMetainfs(CTX, metadataMap, params.pluginRefs);
  }

  this.loadRoutines = function(routineMap, routineContext) {
    return loadAllScripts(CTX, routineMap, 'ROUTINE', routineContext, params.pluginRefs);
  };

  this.loadServices = function(serviceMap) {
    return loadAllGadgets(CTX, serviceMap, 'SERVICE', params.pluginRefs);
  };

  this.loadTriggers = function(triggerMap) {
    return loadAllGadgets(CTX, triggerMap, 'TRIGGER', params.pluginRefs);
  };

  L.has('silly') && L.log('silly', T.toMessage({
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
        },
        "required": ["name", "path"]
      }
    },
    "issueInspector": {
      "type": "object"
    },
    "nameResolver": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "objectDecorator": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    }
  }
};

module.exports = PluginLoader;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

let hasSeparatedDir = function(scriptType) {
  return lodash.filter(constx, function(obj, key) {
    // return ['METAINF', 'ROUTINE', 'SERVICE', 'TRIGGER'].indexOf(key) >= 0;
    return obj.ROOT_KEY && obj.SCRIPT_DIR;
  }).filter(function(info) {
    return info.ROOT_KEY !== constx[scriptType].ROOT_KEY &&
        info.SCRIPT_DIR === constx[scriptType].SCRIPT_DIR;
  }).length === 0;
}

let getFilterPattern = function(scriptType) {
  return hasSeparatedDir(scriptType) ? '.*\.js' : constx[scriptType].ROOT_KEY + '_.*\.js';
}

let loadAllScripts = function(CTX, scriptMap, scriptType, scriptContext, pluginRootDirs) {
  scriptMap = scriptMap || {};

  if (scriptType !== 'ROUTINE') return scriptMap;

  pluginRootDirs.forEach(function(pluginRootDir) {
    loadScriptEntries(CTX, scriptMap, scriptType, scriptContext, pluginRootDir);
  });

  return scriptMap;
};

let loadScriptEntries = function(CTX, scriptMap, scriptType, scriptContext, pluginRootDir) {
  CTX = CTX || this;
  let {L, T, schemaValidator} = CTX;

  let scriptSubDir = chores.getComponentDir(pluginRootDir, scriptType);
  let scriptFolder = path.join(pluginRootDir.pathDir, scriptSubDir);
  L.has('dunce') && L.log('dunce', T.add({
    scriptKey: constx[scriptType].ROOT_KEY,
    scriptFolder: scriptFolder
  }).toMessage({
    text: ' - load ${scriptKey}s from folder: ${scriptFolder}'
  }));

  let scriptFiles = chores.filterFiles(scriptFolder, getFilterPattern(scriptType));
  scriptFiles.forEach(function(scriptFile) {
    loadScriptEntry(CTX, scriptMap, scriptType, scriptSubDir, scriptFile, scriptContext, pluginRootDir);
  });
};

let loadScriptEntry = function(CTX, scriptMap, scriptType, scriptSubDir, scriptFile, scriptContext, pluginRootDir) {
  CTX = CTX || this;
  let {L, T, issueInspector, nameResolver, schemaValidator} = CTX;
  let opStatus = lodash.assign({ type: scriptType, file: scriptFile, subDir: scriptSubDir }, pluginRootDir);
  let filepath = path.join(pluginRootDir.pathDir, scriptSubDir, scriptFile);
  try {
    let scriptInit = loader(filepath, { stopWhenError: true });
    if (lodash.isFunction(scriptInit)) {
      L.has('dunce') && L.log('dunce', T.add({ filepath }).toMessage({
        text: ' - script file ${filepath} is ok'
      }));
      let scriptObject = scriptInit(scriptContext);
      let output = validateScript(CTX, scriptObject, scriptType);
      if (!output.valid) {
        L.has('dunce') && L.log('dunce', T.add({
          validationResult: output
        }).toMessage({
          text: ' - validating script fail: ${validationResult}'
        }));
        opStatus.hasError = true;
      } else if (scriptObject.enabled === false) {
        L.has('dunce') && L.log('dunce', T.toMessage({
          text: ' - script is disabled'
        }));
        opStatus.hasError = false;
        opStatus.isSkipped = true;
      } else {
        L.has('dunce') && L.log('dunce', T.toMessage({
          text: ' - script validation pass'
        }));
        opStatus.hasError = false;
        let scriptName = scriptFile.replace('.js', '').toLowerCase();
        let pluginName = nameResolver.getOriginalNameOf(pluginRootDir.name, pluginRootDir.type);
        if (!chores.isUpgradeSupported('improving-name-resolver')) {
          pluginName = nameResolver.getOriginalName(pluginRootDir);
        }
        let uniqueName = [pluginName, scriptName].join(chores.getSeparator());
        let entry = {};
        entry[uniqueName] = {
          crateScope: pluginName,
          name: scriptName,
          object: scriptObject
        };
        lodash.defaultsDeep(scriptMap, entry);
      }
    } else {
      L.has('dunce') && L.log('dunce', T.add({ filepath }).toMessage({
        text: ' - script file ${filepath} doesnot contain a function.'
      }));
      opStatus.hasError = true;
    }
  } catch (err) {
    L.has('dunce') && L.log('dunce', T.add({ filepath }).toMessage({
      text: ' - script file ${filepath} loading has failed.'
    }));
    opStatus.hasError = true;
    opStatus.stack = err.stack;
  }
  issueInspector.collect(opStatus);
};

let parseScriptTree = function(scriptFile, scriptInstance, isHierarchical) {
  let entryPath = scriptFile.replace('.js', '').toLowerCase().split('_');
  if (entryPath.length > 0 && entryPath[0] !== constx[scriptType].ROOT_KEY) {
    entryPath.unshift(constx[scriptType].ROOT_KEY);
  }
  entryPath = entryPath.reverse();
  entryPath.unshift(scriptInstance);
  let entry = lodash.reduce(entryPath, function(result, item) {
    let nestEntry = {};
    nestEntry[item] = result;
    return nestEntry;
  });
  return entry;
}

let validateScript = function(CTX, scriptObject, scriptType) {
  CTX = CTX || this;
  let {L, T, schemaValidator} = CTX;
  scriptObject = scriptObject || {};
  let results = [];

  results.push(schemaValidator.validate(scriptObject, constx[scriptType].SCHEMA_OBJECT));

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

let loadAllMetainfs = function(CTX, metainfMap, pluginRootDirs) {
  CTX = CTX || this;
  metainfMap = metainfMap || {};
  pluginRootDirs.forEach(function(pluginRootDir) {
    loadMetainfEntries(CTX, metainfMap, pluginRootDir);
  });
  return metainfMap;
}

let loadMetainfEntries = function(CTX, metainfMap, pluginRootDir) {
  CTX = CTX || this;
  let {L, T, schemaValidator} = CTX;
  let metainfType = 'METAINF';
  let metainfSubDir = chores.getComponentDir(pluginRootDir, metainfType);
  let metainfFolder = path.join(pluginRootDir.pathDir, metainfSubDir);
  L.has('dunce') && L.log('dunce', T.add({
    metainfKey: constx[metainfType].ROOT_KEY,
    metainfFolder: metainfFolder
  }).toMessage({
    text: ' - load ${metainfKey}s from folder: ${metainfFolder}'
  }));
  let schemaFiles = chores.filterFiles(metainfFolder, getFilterPattern(metainfType));
  schemaFiles.forEach(function(schemaFile) {
    loadMetainfEntry(CTX, metainfMap, metainfSubDir, schemaFile, pluginRootDir);
  });
}

let loadMetainfEntry = function(CTX, metainfMap, metainfSubDir, schemaFile, pluginRootDir) {
  CTX = CTX || this;
  let {L, T, issueInspector, nameResolver, schemaValidator} = CTX;
  let metainfType = 'METAINF';
  let opStatus = lodash.assign({ type: 'METAINF', file: schemaFile, subDir: metainfSubDir }, pluginRootDir);
  let filepath = path.join(pluginRootDir.pathDir, metainfSubDir, schemaFile);
  try {
    let metainfObject = loader(filepath, { stopWhenError: true });
    let output = validateMetainf(CTX, metainfObject, metainfType);
    if (!output.valid) {
      L.has('dunce') && L.log('dunce', T.add({
        validationResult: output
      }).toMessage({
        text: ' - validating schema fail: ${validationResult}'
      }));
      opStatus.hasError = true;
    } else if (metainfObject.enabled === false) {
      L.has('dunce') && L.log('dunce', T.toMessage({
        text: ' - schema is disabled'
      }));
      opStatus.hasError = false;
      opStatus.isSkipped = true;
    } else {
      L.has('dunce') && L.log('dunce', T.toMessage({
        text: ' - schema validation pass'
      }));
      opStatus.hasError = false;
      let typeName = metainfObject.type || schemaFile.replace('.js', '').toLowerCase();
      let subtypeName = metainfObject.subtype || 'default';
      let crateScope = nameResolver.getOriginalNameOf(pluginRootDir.name, pluginRootDir.type);
      let pluginCode = nameResolver.getDefaultAliasOf(pluginRootDir.name, pluginRootDir.type);
      if (!chores.isUpgradeSupported('improving-name-resolver')) {
        crateScope = nameResolver.getOriginalName(pluginRootDir);
        pluginCode = nameResolver.getDefaultAlias(pluginRootDir);
      }
      let uniqueName = [crateScope, typeName].join(chores.getSeparator());
      let entry = {};
      entry[uniqueName] = entry[uniqueName] || {};
      entry[uniqueName][subtypeName] = {
        crateScope: crateScope,
        pluginCode: pluginCode,
        type: typeName,
        subtype: subtypeName,
        schema: metainfObject.schema
      };
      lodash.defaultsDeep(metainfMap, entry);
    }
  } catch(err) {
    L.has('dunce') && L.log('dunce', T.add({ filepath }).toMessage({
      text: ' - schema file ${filepath} loading has failed'
    }));
    L.has('dunce') && chores.printError(err);
    opStatus.hasError = true;
    opStatus.stack = err.stack;
  }
  issueInspector.collect(opStatus);
}

let validateMetainf = function(CTX, metainfObject) {
  CTX = CTX || this;
  let {L, T, schemaValidator} = CTX;
  let metainfType = 'METAINF';
  metainfObject = metainfObject || {};
  let results = [];
  results.push(schemaValidator.validate(metainfObject, constx[metainfType].SCHEMA_OBJECT));
  return results.reduce(function(output, result) {
    output.valid = output.valid && (result.valid != false);
    output.errors = output.errors.concat(result.errors);
    return output;
  }, { valid: true, errors: [] });
};

let loadAllGadgets = function(CTX, gadgetMap, gadgetType, pluginRootDirs) {
  CTX = CTX || this;
  gadgetMap = gadgetMap || {};

  if (['SERVICE', 'TRIGGER'].indexOf(gadgetType) < 0) return gadgetMap;

  pluginRootDirs.forEach(function(pluginRootDir) {
    loadGadgetEntries(CTX, gadgetMap, gadgetType, pluginRootDir);
  });

  return gadgetMap;
};

let loadGadgetEntries = function(CTX, gadgetMap, gadgetType, pluginRootDir) {
  CTX = CTX || this;
  let {L, T, schemaValidator} = CTX;

  let gadgetSubDir = chores.getComponentDir(pluginRootDir, gadgetType);
  let gadgetFolder = path.join(pluginRootDir.pathDir, gadgetSubDir);
  L.has('dunce') && L.log('dunce', T.add({
    gadgetKey: constx[gadgetType].ROOT_KEY,
    gadgetFolder: gadgetFolder
  }).toMessage({
    text: ' - load ${gadgetKey}s from folder: ${gadgetFolder}'
  }));

  let gadgetFiles = chores.filterFiles(gadgetFolder, getFilterPattern(gadgetType));
  gadgetFiles.forEach(function(gadgetFile) {
    loadGadgetEntry(CTX, gadgetMap, gadgetType, gadgetSubDir, gadgetFile, pluginRootDir);
  });
};

let loadGadgetEntry = function(CTX, gadgetMap, gadgetType, gadgetSubDir, gadgetFile, pluginRootDir) {
  CTX = CTX || this;
  let {L, T, issueInspector, schemaValidator} = CTX;
  let opStatus = lodash.assign({ type: gadgetType, file: gadgetFile, subDir: gadgetSubDir }, pluginRootDir);
  let filepath = path.join(pluginRootDir.pathDir, gadgetSubDir, gadgetFile);
  try {
    let gadgetConstructor = loader(filepath, { stopWhenError: true });
    L.has('dunce') && L.log('dunce', T.add({ filepath }).toMessage({
      text: ' - gadget file ${filepath} loading has done'
    }));
    if (lodash.isFunction(gadgetConstructor)) {
      let gadgetName = chores.stringCamelCase(gadgetFile.replace('.js', ''));
      lodash.defaults(gadgetMap, buildGadgetWrapper(CTX, gadgetConstructor, gadgetType, gadgetName, pluginRootDir));
      opStatus.hasError = false;
    } else {
      L.has('dunce') && L.log('dunce', T.add({ filepath }).toMessage({
        text: ' - gadget file ${filepath} doesnot contain a function'
      }));
      opStatus.hasError = true;
    }
  } catch(err) {
    L.has('dunce') && L.log('dunce', T.add({ filepath }).toMessage({
      text: ' - gadget file ${filepath} loading has failed'
    }));
    L.has('dunce') && chores.printError(err);
    opStatus.hasError = true;
    opStatus.stack = err.stack;
  }
  issueInspector.collect(opStatus);
};

let buildGadgetWrapper = function(CTX, gadgetConstructor, gadgetType, wrapperName, pluginRootDir) {
  CTX = CTX || this;
  let {L, T, nameResolver, objectDecorator, schemaValidator} = CTX;
  let result = {};

  if (!lodash.isFunction(gadgetConstructor)) {
    L.has('dunce') && L.log('dunce', T.toMessage({
      text: ' - gadgetConstructor is invalid'
    }));
    return result;
  }

  let pluginName = nameResolver.getOriginalNameOf(pluginRootDir.name, pluginRootDir.type);
  let pluginCode = nameResolver.getDefaultAliasOf(pluginRootDir.name, pluginRootDir.type);
  if (!chores.isUpgradeSupported('improving-name-resolver')) {
    pluginName = nameResolver.getOriginalName(pluginRootDir);
    pluginCode = nameResolver.getDefaultAlias(pluginRootDir);
  }
  let uniqueName = [pluginName, wrapperName].join(chores.getSeparator());
  let referenceAlias = lodash.get(pluginRootDir, ['presets', 'referenceAlias'], {});

  function wrapperConstructor(kwargs) {
    kwargs = kwargs || {};
    let kwargsRef = null;
    let getWrappedParams = function(kwargs) {
      return kwargsRef = kwargsRef || lodash.clone(kwargs) || {};
    }
    // crateScope & componentName
    kwargs.packageName = pluginRootDir.name;
    kwargs.componentName = wrapperName;
    kwargs.componentId = uniqueName;
    // resolve newFeatures
    let newFeatures = lodash.get(kwargs, ['profileConfig', 'newFeatures', pluginCode], {});
    L.has('dunce') && L.log('dunce', T.add({ pluginCode, newFeatures }).toMessage({
      text: ' - newFeatures[${pluginCode}]: ${newFeatures}'
    }));
    // resolve plugin configuration path
    if (newFeatures.sandboxConfig !== false) {
      kwargs = getWrappedParams(kwargs);
      if (chores.isSpecialPlugin(pluginRootDir.type)) {
        kwargs.sandboxConfig = lodash.get(kwargs, ['sandboxConfig', pluginCode], {});
      } else {
        kwargs.sandboxConfig = lodash.get(kwargs, ['sandboxConfig', 'plugins', pluginCode], {});
      }
    }
    // wrap getLogger() and add getTracer()
    if (newFeatures.logoliteEnabled !== false) {
      kwargs = getWrappedParams(kwargs);
      kwargs.loggingFactory = kwargs.loggingFactory.branch(uniqueName);
    }
    // transform parameters by referenceAlias
    if (!lodash.isEmpty(referenceAlias)) {
      kwargs = getWrappedParams(kwargs);
      lodash.forOwn(referenceAlias, function(oldKey, newKey) {
        if (kwargs[oldKey]) {
          kwargs[newKey] = kwargs[oldKey];
        }
      });
      if (false) {
        // remove the old references
        let newKeys = lodash.keys(referenceAlias);
        let oldKeys = lodash.values(referenceAlias);
        lodash.forEach(oldKeys, function(oldKey) {
          if (newKeys.indexOf(oldKey) < 0) {
            delete kwargs[oldKey];
          }
        });
      }
    }
    // transform parameters by referenceHash (after referenceAlias)
    let referenceHash = gadgetConstructor.referenceHash;
    if (lodash.isObject(referenceHash)) {
      kwargs = getWrappedParams(kwargs);
      lodash.forOwn(referenceHash, function(fullname, shortname) {
        if (kwargs[fullname]) {
          kwargs[shortname] = kwargs[fullname];
        }
      });
    }
    // write around-log begin
    if (newFeatures.logoliteEnabled !== false && chores.isUpgradeSupported('gadget-around-log')) {
      this.logger = kwargs.loggingFactory.getLogger();
      this.tracer = kwargs.loggingFactory.getTracer();
      this.logger.has('silly') && this.logger.log('silly', this.tracer.toMessage({
        tags: [ uniqueName, 'constructor-begin' ],
        text: ' + constructor begin ...'
      }));
    }
    // invoke original constructor
    gadgetConstructor.call(this, kwargs);
    // write around-log end
    if (newFeatures.logoliteEnabled !== false && chores.isUpgradeSupported('gadget-around-log')) {
      this.logger.has('silly') && this.logger.log('silly', this.tracer.toMessage({
        tags: [ uniqueName, 'constructor-end' ],
        text: ' - constructor has finished'
      }));
    }
  }

  util.inherits(wrapperConstructor, gadgetConstructor);

  let wrappedArgumentFields = ["sandboxName", "sandboxConfig", "profileName", "profileConfig", "loggingFactory"];

  if (gadgetConstructor.argumentSchema) {
    let wrappedArgumentSchema = {
      "$id": uniqueName,
      "type": "object",
      "properties": {}
    }
    lodash.forEach(wrappedArgumentFields, function(fieldName) {
      if (['sandboxName', 'profileName'].indexOf(fieldName) >= 0) {
        wrappedArgumentSchema.properties[fieldName] = { "type": "string" }
      } else {
        wrappedArgumentSchema.properties[fieldName] = { "type": "object" }
      }
    });
    let originalArgumentSchema = gadgetConstructor.argumentSchema;
    if (originalArgumentSchema['$id']) {
      originalArgumentSchema = lodash.omit(originalArgumentSchema, ['$id']);
    }
    wrapperConstructor.argumentSchema = lodash.merge(wrappedArgumentSchema, originalArgumentSchema);
    if (!lodash.isEmpty(referenceAlias)) {
      let properties = lodash.mapKeys(gadgetConstructor.argumentSchema.properties, function(val, key) {
        return referenceAlias[key] || key;
      });
      wrapperConstructor.argumentSchema = lodash.merge(wrappedArgumentSchema, {
        properties: properties
      });
    }
    L.has('dunce') && L.log('dunce', T.add({
      argumentSchema: wrapperConstructor.argumentSchema
    }).toMessage({
      text: ' - wrapperConstructor.argumentSchema: ${argumentSchema}'
    }));
  } else {
    let wrappedArgumentProps = gadgetConstructor.referenceList || [];
    if (gadgetConstructor.referenceHash) {
      wrappedArgumentProps = lodash.values(gadgetConstructor.referenceHash);
    }
    if (!lodash.isEmpty(referenceAlias)) {
      wrappedArgumentProps = lodash.map(wrappedArgumentProps, function(key) {
        return referenceAlias[key] || key;
      });
    }
    wrappedArgumentProps = wrappedArgumentFields.concat(wrappedArgumentProps);
    wrapperConstructor.argumentProperties = lodash.uniq(wrappedArgumentProps);
    L.has('dunce') && L.log('dunce', T.add({
      argumentProperties: wrapperConstructor.argumentProperties
    }).toMessage({
      text: ' - wrapperConstructor.argumentProperties: ${argumentProperties}'
    }));
  }

  let construktor = wrapperConstructor;
  const gadgetGroup = lodash.get(constx, [gadgetType, 'GROUP']);
  if (['reducers', 'services', 'triggers'].indexOf(gadgetGroup) >= 0) {
    construktor = objectDecorator.wrapPluginGadget(construktor, {
      pluginName: pluginName,
      gadgetType: gadgetGroup,
      gadgetName: wrapperName
    });
  }

  result[uniqueName] = {
    crateScope: pluginName,
    name: wrapperName,
    construktor: construktor
  };

  L.has('dunce') && L.log('dunce', T.add({
    uniqueName: uniqueName,
    crateScope: pluginName,
    name: wrapperName
  }).toMessage({
    text: ' - build gadget wrapper (${name}) has done.'
  }));

  return result;
};
