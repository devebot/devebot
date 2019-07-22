'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lodash = require('lodash');
const chores = require('../utils/chores');
const blockRef = chores.getBlockRef(__filename);

function MappingLoader(params = {}) {
  const loggingFactory = params.loggingFactory.branch(blockRef);
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  this.loadMappings = function(mappingStore, options = {}) {
    let mappings = {};
    if (lodash.isString(mappingStore)) {
      const store = {};
      store[chores.getUUID()] = mappingStore;
      mappingStore = store;
    }
    if (lodash.isObject(mappingStore)) {
      lodash.forOwn(mappingStore, function(descriptor, bundle) {
        L.has('debug') && L.log('debug', T.add({
          bundle, enabled: descriptor && descriptor.enabled !== false
        }).toMessage({
          tags: [ blockRef, 'load-mappings' ],
          text: ' - load the mappings bundle [${bundle}] - enable: ${enabled}'
        }));
        if (lodash.isString(descriptor)) {
          descriptor = { location: descriptor }
        }
        if (descriptor && descriptor.enabled !== false) {
          lodash.defaults(descriptor, lodash.pick(options, [
            'evaluated', 'fileFilter', 'keyGenerator'
          ]));
          let accum = loadMappingStore(bundle, descriptor);
          lodash.merge(mappings, accum);
        }
      });
    }
    return mappings;
  }

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

MappingLoader.argumentSchema = {
  "$id": "mappingLoader",
  "type": "object",
  "properties": {
    "appName": {
      "type": "string"
    },
    "appInfo": {
      "type": "object"
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "issueInspector": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    }
  }
};

MappingLoader.MAPPING_STORE_SCHEMA = {
  "type": "object",
  "patternProperties": {
    "^.+$": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean"
            },
            "location": {
              "type": "string"
            },
            "evaluated": {
              "type": "boolean"
            },
            "fileFilter": {
            },
            "keyGenerator": {
            }
          },
          "additionalProperties": false
        }
      ]
    }
  }
};

module.exports = MappingLoader;

function validateDescriptor(ctx = {}, scriptObject = {}) {
  const { schemaValidator } = ctx;
  const results = [];

  results.push(schemaValidator.validate(scriptObject, MappingLoader.MAPPING_STORE_SCHEMA));

  if (scriptObject.fileFilter != null && !lodash.isFunction(scriptObject.fileFilter)) {
    results.push({
      valid: false,
      errors: [{
        message: 'fileFilter has wrong type: ' + typeof(scriptObject.fileFilter)
      }]
    });
  }

  if (scriptObject.keyGenerator != null && !lodash.isFunction(scriptObject.keyGenerator)) {
    results.push({
      valid: false,
      errors: [{
        message: 'keyGenerator has wrong type: ' + typeof(scriptObject.keyGenerator)
      }]
    });
  }

  return results.reduce(function(output, result) {
    output.valid = output.valid && (result.valid !== false);
    output.errors = output.errors.concat(result.errors);
    return output;
  }, { valid: true, errors: [] });
};

function loadMappingStore(mappingName, { location, fileFilter, keyGenerator, evaluated }) {
  if (!lodash.isFunction(fileFilter)) {
    fileFilter = defaultFileFilter;
  }
  if (!lodash.isFunction(keyGenerator)) {
    keyGenerator = defaultKeyGenerator;
  }
  let mappings = {};
  let mappingStat;
  try {
    mappingStat = fs.statSync(location);
  } catch (err) {
    location = location + '.js';
    try {
      mappingStat = fs.statSync(location);
    } catch (e__) {
      throw err;
    }
  }
  const loadMappingFile = function (mappings, mappingName, evaluated, fileInfo) {
    const mappingFile = path.join(fileInfo.dir, fileInfo.base);
    const mappingBody = evaluateMappingFile(mappingFile, mappingName, evaluated);
    const mappingId = keyGenerator(mappingName, fileInfo, mappingBody);
    if (lodash.isEmpty(mappingId)) {
      if (lodash.isObject(mappingBody)) {
        lodash.assign(mappings, mappingBody);
      }
    } else {
      mappings[mappingId] = mappingBody;
    }
  }
  if (mappingStat.isFile()) {
    const fileInfo = lodash.assign(path.parse(location), { standalone: true });
    loadMappingFile(mappings, mappingName, evaluated, fileInfo);
  }
  if (mappingStat.isDirectory()) {
    let multifiles = true;
    try {
      const indexFile = path.join(location, 'index.js');
      const indexStat = fs.statSync(indexFile);
      if (indexStat.isFile()) {
        const fileInfo = lodash.assign(path.parse(indexFile), { standalone: true });
        loadMappingFile(mappings, mappingName, evaluated, fileInfo);
        multifiles = false;
      }
    } catch (err) {}
    if (multifiles) {
      const fileInfos = traverseDir(location, fileFilter);
      lodash.forEach(fileInfos, function(fileInfo) {
        loadMappingFile(mappings, mappingName, evaluated, fileInfo);
      });
    }
  }
  return mappings;
}

function defaultFileFilter (fileInfo) {
  return fileInfo.ext === '.js';
}

function defaultKeyGenerator (mappingName, fileInfo, fileBody) {
  return mappingName;
}

function evaluateMappingFile(mappingPath, mappingName, evaluated) {
  const mappingBody = requireMappingFile(mappingPath);
  if (lodash.isFunction(mappingBody) && evaluated !== false) {
    try {
      return mappingBody(mappingName);
    } catch (err) {}
  }
  return mappingBody;
}

function requireMappingFile(mappingFile) {
  try {
    return require(mappingFile);
  } catch (err) {
    return null;
  }
}

function traverseDir(dir, filter, fileInfos) {
  if (!lodash.isFunction(filter)) {
    let exts = filter;
    if (exts != null) {
      if (lodash.isRegExp(exts)) {
        filter = function (fileInfo) {
          if (fileInfo == null) return true;
          return exts.test(path.join(fileInfo.path, fileInfo.base));
        }
      } else {
        if (!lodash.isArray(exts)) {
          exts = [exts];
        }
        filter = function (fileInfo) {
          if (fileInfo == null) return true;
          for(const i in exts) {
            const ext = exts[i];
            const filepath = path.join(fileInfo.path, fileInfo.base);
            if (filepath.indexOf(ext.toString()) >= 0) {
              return true;
            }
          }
          return false;
        }
      }
    }
  }
  if (!lodash.isArray(fileInfos)) {
    fileInfos = [];
  }
  try {
    dir = path.normalize(dir);
    if (dir && dir !== path.sep && dir.length > 1 && dir.endsWith(path.sep)) {
      dir = dir.substring(0, dir.length - 1);
    }
    return traverseDirRecursively(dir, dir, filter, fileInfos);
  } catch (err) {
    return fileInfos;
  }
}

function traverseDirRecursively(homeDir, dir, filter, fileInfos = []) {
  assert.ok(filter == null || lodash.isFunction(filter));
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const filename = path.join(dir, files[i]);
    const filestat = fs.statSync(filename);
    if (filestat.isDirectory()) {
      traverseDirRecursively(homeDir, filename, filter, fileInfos);
    } else if (filestat.isFile()) {
      const fileInfo = path.parse(filename);
      if (filter == null || filter(fileInfo)) {
        fileInfos.push({
          home: homeDir,
          path: fileInfo.dir.slice(homeDir.length),
          dir: fileInfo.dir,
          base: fileInfo.base,
          name: fileInfo.name,
          ext: fileInfo.ext
        });
      }
    }
  }
  return fileInfos;
}
