'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');
const getenv = require('../utils/getenv');
const blockRef = chores.getBlockRef(__filename);

function ProcessManager(params={}) {
  let self = this;
  let issueInspector = params.issueInspector;
  let loggingFactory = params.loggingFactory.branch(blockRef);
  let LX = loggingFactory.getLogger();
  let LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let clusterCfg = lodash.get(params, ['profileConfig', 'cluster'], {});

  let pm_id = parseInt(getenv(clusterCfg.ENV_ID_NAMES || ['pm_id', 'NODE_APP_INSTANCE']));
  let pm_total = parseInt(getenv(clusterCfg.ENV_TOTAL_NAMES || ['instances']));

  LX.has('debug') && LX.log('debug', LT.add({ pm_id, pm_total }).toMessage({
    tags: [ blockRef, 'pm2-env-vars' ],
    text: 'PM2 environment: id: ${pm_id} / total: ${pm_total}'
  }));

  Object.defineProperty(this, 'available', {
    get: function() {
      return typeof(pm_id) === 'number' && !isNaN(pm_id) &&
          typeof(pm_total) === 'number' && !isNaN(pm_total);
    },
    set: function(value) {}
  });

  Object.defineProperty(this, 'isMaster', {
    get: function() {
      if (!this.available || pm_id < 0 || pm_total <= 0) return false;
      return (pm_id % pm_total) == 0;
    },
    set: function(value) {}
  });

  Object.defineProperty(this, 'id', {
    get: function() {
      return typeof(pm_id) === 'number' && !isNaN(pm_id) ? pm_id : undefined;
    },
    set: function(value) {}
  });

  Object.defineProperty(this, 'total', {
    get: function() {
      return typeof(pm_total) === 'number' && !isNaN(pm_total) ? pm_total : undefined;
    },
    set: function(value) {}
  });

  this.belongTo = function(idx) {
    if (!this.available || pm_id < 0 || pm_total <= pm_id) return null;
    while(idx >= pm_total) idx -= pm_total;
    return idx === pm_id;
  }

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

ProcessManager.argumentSchema = {
  "$id": "processManager",
  "type": "object",
  "properties": {
    "profileConfig": {
      "type": "object"
    },
    "issueInspector": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = ProcessManager;
