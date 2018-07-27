'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');
const envbox = require('../utils/envbox');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

function ContextManager(params) {
  params = params || {};

  let self = this;
  let errorCollector = params.errorCollector;
  let loggingWrapper = new LoggingWrapper(blockRef);
  let LX = loggingWrapper.getLogger();
  let LT = loggingWrapper.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let defaultFeatures = [];
  let featureDisabled;
  let featureEnabled;

  this.clearCache = function() {
    featureDisabled = null;
    featureEnabled = null;
    return this;
  }

  this.addDefaultFeatures = function(features) {
    if (features) {
      features = chores.arrayify(features);
      let newFeatures = lodash.union(defaultFeatures, features);
      Array.prototype.splice.call(defaultFeatures, 0);
      Array.prototype.push.apply(defaultFeatures, newFeatures);
    }
    return this;
  }

  this.isFeatureSupported = function(labels) {
    if (!featureDisabled) {
      featureDisabled = envbox.getEnv('FEATURE_DISABLED');
    }
    if (!featureEnabled) {
      featureEnabled = envbox.getEnv('FEATURE_ENABLED');
    }
    labels = chores.arrayify(labels);
    let ok = true;
    for(let k in labels) {
      if (!checkFeatureSupported(labels[k])) return false;
    }
    return true;
  }

  let checkFeatureSupported = function(label) {
    if (featureDisabled.indexOf(label) >= 0) return false;
    if (defaultFeatures.indexOf(label) >= 0) return true;
    return (featureEnabled.indexOf(label) >= 0);
  }

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

ContextManager.argumentSchema = {
  "$id": "contextManager",
  "type": "object",
  "properties": {
    "errorCollector": {
      "type": "object"
    }
  }
};

module.exports = ContextManager;
