'use strict';

const lodash = require('lodash');
const LogTracer = require('logolite').LogTracer;
const LoggingWrapper = require('./logging-wrapper');
const chores = require('../utils/chores');
const errorHandler = require('./error-handler').instance;
const blockRef = chores.getBlockRef(__filename);

function NameResolver(params) {
  params = params || {};

  let loggingWrapper = new LoggingWrapper(blockRef);
  let LX = loggingWrapper.getLogger();
  let LT = loggingWrapper.getTracer();
  let CTX = {LX, LT};

  LX.has('silly') && LX.log('silly', LT.toMessage({
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

  this.getOriginalName = this.getAliasBy.bind(this, 'name');

  this.getDefaultAlias = this.getAliasBy.bind(this, 'codeInCamel');

  extractAliasNames(CTX, 'plugin', params.pluginRefs);
  extractAliasNames(CTX, 'bridge', params.bridgeRefs);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

NameResolver.argumentSchema = {
  "$id": "nameResolver",
  "type": "object",
  "properties": {
    "pluginRefs": {
      "type": "array"
    },
    "bridgeRefs": {
      "type": "array"
    }
  }
};

module.exports = NameResolver;

const LIB_NAME_PATTERNS = {
  bridge: [
    /^devebot-co-([a-z][a-z0-9\-]*[a-z0-9])$/g,
    /^([a-z][a-z0-9\-]*[a-z0-9])$/g
  ],
  plugin: [
    /^devebot-dp-([a-z][a-z0-9\-]*[a-z0-9])$/g,
    /^([a-z][a-z0-9\-]*[a-z0-9])$/g
  ]
}

let extractAliasNames = function(ctx, type, myRefs) {
  let generateAlias = function(myRef, myId) {
    let info = chores.extractCodeByPattern(ctx, LIB_NAME_PATTERNS[type], myRef.name);
    if (info.i >= 0) {
      myRef.code = info.code;
      myRef.codeInCamel = info.codeInCamel;
      if (info.code == myRef.name) {
        myRef.nameInCamel = info.codeInCamel;
      } else {
        myRef.nameInCamel = chores.stringCamelCase(myRef.name);
      }
    } else {
      errorHandler.collect(lodash.assign({
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
