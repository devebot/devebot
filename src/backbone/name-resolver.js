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
