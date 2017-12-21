'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');
var lodash = require('lodash');
var constx = require('../utils/constx.js');
var chores = require('../utils/chores.js');
var debugx = require('../utils/debug.js')('devebot:jobqueue:master');

var Service = function(params) {
  var self = this;
  params = params || {};

  debugx.enabled && debugx(' + constructor start ...');

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

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  debugx.enabled && debugx(' - create a jobqueueMaster instance in sandbox <%s>', self.getSandboxName());

  if (self.enabled === false) {
    debugx.enabled && debugx(' - jobqueueMaster in sandbox <%s> is disabled', self.getSandboxName());
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

  debugx.enabled && debugx(' - jobqueueMaster instance in sandbox <%s> has been created', self.getSandboxName());
  debugx.enabled && debugx(' - constructor has finished');
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
