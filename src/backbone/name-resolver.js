'use strict';

const lodash = require('lodash');
const LoggingWrapper = require('./logging-wrapper');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const blockRef = chores.getBlockRef(__filename);

function NameResolver(params={}) {
  let loggingWrapper = new LoggingWrapper(blockRef);
  let L = loggingWrapper.getLogger();
  let T = loggingWrapper.getTracer();
  let CTX = {L, T, issueInspector: params.issueInspector};

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let absoluteAliasMap, relativeAliasMap;

  this.getAbsoluteAliasMap = function() {
    absoluteAliasMap = absoluteAliasMap || {
      plugin: buildAbsoluteAliasMap(params.pluginRefs),
      bridge: buildAbsoluteAliasMap(params.bridgeRefs)
    }
    return absoluteAliasMap;
  }

  this.getRelativeAliasMap = function() {
    relativeAliasMap = relativeAliasMap || {
      plugin: buildRelativeAliasMap(params.pluginRefs),
      bridge: buildRelativeAliasMap(params.bridgeRefs)
    }
    return relativeAliasMap;
  }

  this.getAliasBy = function(selectedField, crateDescriptor) {
    crateDescriptor = crateDescriptor || {};
    let crateAlias = crateDescriptor[selectedField];
    if (crateDescriptor.type === 'application') {
      crateAlias = crateDescriptor.type;
    }
    return crateAlias;
  }

  this.getOriginalNameOf = function(crateName, crateType) {
    if (crateType === 'plugin' || crateType === 'bridge') {
      let absoluteAlias = this.getAbsoluteAliasMap();
      crateName = absoluteAlias[crateType][crateName] || crateName;
    }
    return crateName;
  }

  this.getOriginalName = this.getAliasBy.bind(this, 'name');

  this.getDefaultAliasOf = function(crateName, crateType) {
    if (crateType === 'plugin' || crateType === 'bridge') {
      crateName = this.getOriginalNameOf(crateName, crateType);
      let relativeAlias = this.getRelativeAliasMap();
      crateName = relativeAlias[crateType][crateName] || crateName;
    }
    return crateName;
  }

  this.getDefaultAlias = this.getAliasBy.bind(this, 'codeInCamel');

  extractAliasNames(CTX, 'plugin', params.pluginRefs);
  extractAliasNames(CTX, 'bridge', params.bridgeRefs);

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
        "required": ["name"]
      }
    },
    "bridgeRefs": {
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

let extractAliasNames = function(ctx, type, myRefs) {
  let generateAlias = function(myRef, myId) {
    let info = chores.extractCodeByPattern(ctx, LIB_NAME_PATTERNS[type], myRef.name);
    if (info.i >= 0) {
      myRef.code = info.code;
      myRef.codeInCamel = chores.stringCamelCase(myRef.code);
      if (myRef.name == myRef.code) {
        myRef.nameInCamel = myRef.codeInCamel;
      } else {
        myRef.nameInCamel = chores.stringCamelCase(myRef.name);
      }
    } else {
      issueInspector.collect(lodash.assign({
        stage: 'naming',
        type: type,
        hasError: true,
        stack: LIB_NAME_PATTERNS[type].toString()
      }, myRef));
    }
  }
  if (lodash.isArray(myRefs)) {
    lodash.forEach(myRefs, generateAlias);
  } else if (lodash.isObject(myRefs)) {
    lodash.forOwn(myRefs, generateAlias);
  }
  return myRefs;
}

let buildAbsoluteAliasMap = function(myRefs, aliasMap) {
  aliasMap = aliasMap || {};
  lodash.forEach(myRefs, function(myRef) {
    aliasMap[myRef.name] = myRef.name;
    aliasMap[myRef.nameInCamel] = myRef.name;
    aliasMap[myRef.code] = aliasMap[myRef.code] || myRef.name;
    aliasMap[myRef.codeInCamel] = aliasMap[myRef.codeInCamel] || myRef.name;
  });
  return aliasMap;
}

let buildRelativeAliasMap = function(myRefs, aliasMap) {
  aliasMap = aliasMap || {};
  lodash.forEach(myRefs, function(myRef) {
    aliasMap[myRef.name] = myRef.codeInCamel;
  });
  return aliasMap;
}
