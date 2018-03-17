'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var Service = function(params) {
  var self = this;
  params = params || {};

  var crateID = chores.getBlockRef(__filename);
  var loggingFactory = params.loggingFactory.branch(crateID);
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.add({
    sandboxName: params.sandboxName
  }).toMessage({
    tags: [ crateID, 'constructor-begin' ],
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

  Object.defineProperties(this, {
    enabled: {
      get: function() {
        var enabled = jqCfg.enabled !== false && getJobQueueMaster() != null;
        LX.has('conlog') && LX.log('conlog', LT.add({
          enabled: enabled,
          sandboxName: params.sandboxName
        }).toMessage({
          text: ' - jobqueueMaster in sandbox <{sandboxName}> status (enabled): {enabled}'
        }));
        return enabled;
      },
      set: function(value) {}
    },
    instance: {
      get: function() {
        return getJobQueueMaster();
      },
      set: function(value) {}
    }
  });

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ crateID, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.argumentSchema = {
  "$id": "jobqueueBinder",
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
