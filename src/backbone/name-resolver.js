'use strict';

const lodash = require('lodash');
const LoggingWrapper = require('./logging-wrapper');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const nodash = require('../utils/nodash');
const blockRef = chores.getBlockRef(__filename);

function NameResolver(params={}) {
  const {issueInspector, bridgeList, pluginList} = params;
  const loggingWrapper = new LoggingWrapper(blockRef);
  const L = loggingWrapper.getLogger();
  const T = loggingWrapper.getTracer();
  const CTX = {L, T, issueInspector};

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  const absoluteAliasMap = {}, relativeAliasMap = {};

  function _getAbsoluteAliasMap() {
    absoluteAliasMap.plugin = absoluteAliasMap.plugin || buildAbsoluteAliasMap(pluginList);
    absoluteAliasMap.bridge = absoluteAliasMap.bridge || buildAbsoluteAliasMap(bridgeList);
    return absoluteAliasMap;
  }

  function _getRelativeAliasMap() {
    relativeAliasMap.plugin = relativeAliasMap.plugin || buildRelativeAliasMap(pluginList);
    relativeAliasMap.bridge = relativeAliasMap.bridge || buildRelativeAliasMap(bridgeList);
    return relativeAliasMap;
  }

  function _getOriginalNameOf(crateName, crateType) {
    switch(crateType) {
      case 'application': {
        crateName = crateType;
        break;
      }
      case 'plugin':
      case 'bridge': {
        const absoluteAlias = _getAbsoluteAliasMap();
        crateName = absoluteAlias[crateType][crateName] || crateName;
        break;
      }
    }
    return crateName;
  }

  function _getDefaultAliasOf(crateName, crateType) {
    switch(crateType) {
      case 'application': {
        crateName = crateType;
        break;
      }
      case 'plugin':
      case 'bridge': {
        crateName = _getOriginalNameOf(crateName, crateType);
        const relativeAlias = _getRelativeAliasMap();
        crateName = relativeAlias[crateType][crateName] || crateName;
        break;
      }
    }
    return crateName;
  }

  this.getOriginalNameOf = _getOriginalNameOf;
  this.getDefaultAliasOf = _getDefaultAliasOf;

  if (!chores.isUpgradeSupported('simplify-name-resolver')) {
    this.getAbsoluteAliasMap = _getAbsoluteAliasMap;
    this.getRelativeAliasMap = _getRelativeAliasMap;
  }

  if (!chores.isUpgradeSupported('refining-name-resolver')) {
    this.getAliasBy = function(selectedField, crateDescriptor) {
      crateDescriptor = crateDescriptor || {};
      if (crateDescriptor.type === 'application') {
        return crateDescriptor.type;
      }
      if (crateDescriptor.type in LIB_NAME_PATTERNS) {
        if (!hasSupportFields(crateDescriptor)) {
          extractAliasNames(CTX, crateDescriptor.type, [crateDescriptor]);
        }
      }
      return crateDescriptor[selectedField];
    }
    this.getOriginalName = this.getAliasBy.bind(this, 'name');
    this.getDefaultAlias = this.getAliasBy.bind(this, 'codeInCamel');
  }

  extractAliasNames(CTX, 'plugin', pluginList);
  extractAliasNames(CTX, 'bridge', bridgeList);

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

NameResolver.argumentSchema = {
  "$id": "nameResolver",
  "type": "object",
  "properties": {
    "issueInspector": {
      "type": "object"
    },
    "pluginList": {
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
        "required": ["name"]
      }
    },
    "bridgeList": {
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
        "required": ["name"]
      }
    }
  }
};

module.exports = NameResolver;

const LIB_NAME_PATTERNS = {
  bridge: [
    new RegExp("^" + constx.FRAMEWORK.NAME + "-co-([a-z][a-z0-9\-]*[a-z0-9])$", "g"),
    /^([a-z][a-z0-9\-]*[a-z0-9])$/g
  ],
  plugin: [
    new RegExp("^" + constx.FRAMEWORK.NAME + "-dp-([a-z][a-z0-9\-]*[a-z0-9])$" ,"g"),
    /^([a-z][a-z0-9\-]*[a-z0-9])$/g
  ]
}

function hasSupportFields(moduleRef) {
  return nodash.isString(moduleRef.code) && nodash.isString(moduleRef.codeInCamel) &&
      nodash.isString(moduleRef.name) && nodash.isString(moduleRef.nameInCamel);
}

function extractAliasNames(ctx, type, moduleRefs) {
  const {issueInspector} = ctx;
  function buildSupportFields(moduleRef) {
    const info = chores.extractCodeByPattern(LIB_NAME_PATTERNS[type], moduleRef.name);
    if (info.i >= 0) {
      moduleRef.code = info.code;
      moduleRef.codeInCamel = chores.stringCamelCase(moduleRef.code);
      if (moduleRef.name == moduleRef.code) {
        moduleRef.nameInCamel = moduleRef.codeInCamel;
      } else {
        moduleRef.nameInCamel = chores.stringCamelCase(moduleRef.name);
      }
    } else {
      issueInspector.collect(lodash.assign({
        stage: 'naming',
        type: type,
        hasError: true,
        stack: LIB_NAME_PATTERNS[type].toString()
      }, moduleRef));
    }
  }
  if (lodash.isArray(moduleRefs)) {
    lodash.forEach(moduleRefs, buildSupportFields);
  } else if (lodash.isObject(moduleRefs)) {
    lodash.forOwn(moduleRefs, buildSupportFields);
  }
  return moduleRefs;
}

function buildAbsoluteAliasMap(moduleRefs, aliasMap) {
  aliasMap = aliasMap || {};
  lodash.forEach(moduleRefs, function(moduleRef) {
    aliasMap[moduleRef.name] = moduleRef.name;
    aliasMap[moduleRef.nameInCamel] = moduleRef.name;
    aliasMap[moduleRef.code] = aliasMap[moduleRef.code] || moduleRef.name;
    aliasMap[moduleRef.codeInCamel] = aliasMap[moduleRef.codeInCamel] || moduleRef.name;
  });
  return aliasMap;
}

function buildRelativeAliasMap(moduleRefs, aliasMap) {
  aliasMap = aliasMap || {};
  lodash.forEach(moduleRefs, function(moduleRef) {
    aliasMap[moduleRef.name] = moduleRef.codeInCamel;
  });
  return aliasMap;
}
