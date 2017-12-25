'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');
var lodash = require('lodash');
var constx = require('../utils/constx.js');
var chores = require('../utils/chores.js');
var LogAdapter = require('logolite').LogAdapter;
var LX = LogAdapter.getLogger({ scope: 'devebot:jobqueue:master' });
var LogTracer = require('logolite').LogTracer;

var Service = function(params) {
  var self = this;
  params = params || {};

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  var LT = LogTracer.ROOT
      .branch({ key: 'serviceName', value: 'jobqueueMaster' })
      .branch({ key: 'serviceId', value: LogTracer.getLogID() });

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: params.sandboxName
  }).stringify({
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
      return Promise.reject(util.format('jobqueue on sandbox[%s] is disabled', self.getSandboxName()));
    }

    if (getJobQueueMaster() == null) {
      return Promise.reject(util.format('jobqueueMaster on sandbox[%s] not found', self.getSandboxName()));
    }

    return getJobQueueMaster().enqueueJob(runhook, context);
  };

  LX.has('conlog') && LX.log('conlog', LT.stringify({
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
