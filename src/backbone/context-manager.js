'use strict';

const lodash = require('lodash');
const chores = require('../utils/chores');
const envbox = require('../utils/envbox');
const nodash = require('../utils/nodash');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

function ContextManager(params = {}) {
  const issueInspector = params.issueInspector;
  const loggingWrapper = new LoggingWrapper(blockRef);
  const L = loggingWrapper.getLogger();
  const T = loggingWrapper.getTracer();
  const defaultFeatures = [];
  const _ref_ = {};

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  this.clearCache = function() {
    _ref_.featureDisabled = null;
    _ref_.featureEnabled = null;
    return this;
  }

  this.getSystemVariable = function(envName, defaultValue) {
    return envbox.getEnv(envName, defaultValue);
  }

  this.setSystemVariable = function(envName, newValue) {
    envbox.setEnv(envName, newValue);
    return this;
  }

  this.addDefaultFeatures = function(features) {
    if (features) {
      features = nodash.arrayify(features);
      const newFeatures = lodash.union(defaultFeatures, features);
      Array.prototype.splice.call(defaultFeatures, 0);
      Array.prototype.push.apply(defaultFeatures, newFeatures);
    }
    return this;
  }

  this.isFeatureSupported = function(labels) {
    if (!_ref_.featureDisabled) {
      _ref_.featureDisabled = envbox.getEnv('FEATURE_DISABLED');
    }
    if (!_ref_.featureEnabled) {
      _ref_.featureEnabled = envbox.getEnv('FEATURE_ENABLED');
    }
    labels = nodash.arrayify(labels);
    for (const k in labels) {
      if (!checkFeatureSupported(labels[k])) return false;
    }
    return true;
  }

  function checkFeatureSupported(label) {
    if (_ref_.featureDisabled.indexOf(label) >= 0) return false;
    if (defaultFeatures.indexOf(label) >= 0) return true;
    return (_ref_.featureEnabled.indexOf(label) >= 0);
  }

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

ContextManager.argumentSchema = {
  "$id": "contextManager",
  "type": "object",
  "properties": {
    "issueInspector": {
      "type": "object"
    }
  }
};

module.exports = ContextManager;
