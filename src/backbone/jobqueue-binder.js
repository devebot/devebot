'use strict';

const lodash = require('lodash');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const blockRef = chores.getBlockRef(__filename);

function JobqueueBinder(params={}) {
  let self = this;
  let loggingFactory = params.loggingFactory.branch(blockRef);
  let L = loggingFactory.getLogger();
  let T = loggingFactory.getTracer();
  let sandboxName = params.sandboxName;

  L.has('silly') && L.log('silly', T.add({ sandboxName }).toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  let jqCfg = lodash.get(params, ['profileConfig', constx.FRAMEWORK.NAME, 'jobqueue'], {});

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
        L.has('dunce') && L.log('dunce', T.add({ enabled, sandboxName }).toMessage({
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

  L.has('silly') && L.log('silly', T.toMessage({
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
