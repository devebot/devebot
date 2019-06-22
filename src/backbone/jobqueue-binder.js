'use strict';

const lodash = require('lodash');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const blockRef = chores.getBlockRef(__filename);

function JobqueueBinder(params = {}) {
  const loggingFactory = params.loggingFactory.branch(blockRef);
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const sandboxName = params.sandboxName;

  L.has('silly') && L.log('silly', T.add({ sandboxName }).toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  const jqCfg = lodash.get(params, ['profileConfig', constx.FRAMEWORK.NAME, 'jobqueue'], {});
  const _ref_ = { jobqueueMasterName: null, jobqueueMaster: null }

  function getJobqueueMasterName() {
    return _ref_.jobqueueMasterName = _ref_.jobqueueMasterName ||
        jqCfg.pluginId && [jqCfg.pluginId, "jobqueueMaster"].join(chores.getSeparator());
  }

  function getJobQueueMaster() {
    return _ref_.jobqueueMaster = _ref_.jobqueueMaster ||
        getJobqueueMasterName() && params.injectedHandlers[getJobqueueMasterName()];
  }

  Object.defineProperties(this, {
    enabled: {
      get: function() {
        const enabled = jqCfg.enabled !== false && getJobQueueMaster() != null;
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
