'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const blockRef = chores.getBlockRef(__filename);

function JobqueueBinder(params) {
  let self = this;
  params = params || {};

  let loggingFactory = params.loggingFactory.branch(blockRef);
  let LX = loggingFactory.getLogger();
  let LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.add({
    sandboxName: params.sandboxName
  }).toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  let jqCfg = lodash.get(params, ['profileConfig', 'devebot', 'jobqueue'], {});

  let jobqueueMasterName = null;
  let getJobqueueMasterName = function() {
    return jobqueueMasterName = jobqueueMasterName ||
        jqCfg.pluginId && [jqCfg.pluginId, "jobqueueMaster"].join(chores.getSeparator());
  }

  let jobqueueMaster = null;
  let getJobQueueMaster = function() {
    return jobqueueMaster = jobqueueMaster ||
        getJobqueueMasterName() && params.injectedHandlers[getJobqueueMasterName()];
  }

  Object.defineProperties(this, {
    enabled: {
      get: function() {
        let enabled = jqCfg.enabled !== false && getJobQueueMaster() != null;
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
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

JobqueueBinder.argumentSchema = {
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

module.exports = JobqueueBinder;
