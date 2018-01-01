'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var Service = function(params) {
  var self = this;
  params = params || {};

  var getSandboxName = function() {
    return params.sandboxName;
  };

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: params.sandboxName
  }).stringify({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  var jqCfg = lodash.get(params, ['profileConfig', 'devebot', 'jobqueue'], {});

  var jobqueueMasterName = null;
  var getJobqueueMasterName = function() {
    return jobqueueMasterName = jobqueueMasterName ||
        jqCfg.pluginId && [jqCfg.pluginId, "jobqueueMaster"].join(chores.getSeparator());
  }

  var jobqueueMaster = null;
  var getJobQueueMaster = function() {
    return jobqueueMaster = jobqueueMaster ||
        getJobqueueMasterName() && params.injectedHandlers[getJobqueueMasterName()];
  }

  Object.defineProperty(this, 'enabled', {
    get: function() {
      return jqCfg.enabled !== false && getJobQueueMaster() != null;
    },
    set: function(value) {}
  });

  if (self.enabled === false) {
    LX.has('conlog') && LX.log('conlog', LT.add({
      enabled: self.enabled,
      sandboxName: params.sandboxName
    }).stringify({
      text: ' - jobqueueMaster in sandbox <{sandboxName}> status (enabled): {enabled}'
    }));
  }

  self.enqueueJob = function(runhook, context) {
    if (self.enabled === false) {
      return Promise.reject(util.format('jobqueue on sandbox[%s] is disabled', getSandboxName()));
    }

    if (getJobQueueMaster() == null) {
      return Promise.reject(util.format('jobqueueMaster on sandbox[%s] not found', getSandboxName()));
    }

    return getJobQueueMaster().enqueueJob(runhook, context);
  };

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.argumentSchema = {
  "id": "jobqueueMaster",
  "type": "object",
  "properties": {
    "sandboxName": {
      "type": "string"
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "injectedHandlers": {
      "type": "object"
    }
  }
};

module.exports = Service;
