'use strict';

const DEFAULT_SCOPE = require('./getenv')('DEVEBOT_DEFAULT_SCOPE', 'devebot');
const debugx = require('./pinbug')(DEFAULT_SCOPE + ':utils:pmtool');

function PmTool() {
  let pm_id = parseInt(process.env.pm_id);
  let pm_total = parseInt(process.env.instances);

  debugx.enabled && debugx('PM2 environment: id: %s / total: %s', pm_id, pm_total);

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

  Object.defineProperty(this, 'enabled', {
    get: function() {
      return typeof(pm_id) === 'number' && !isNaN(pm_id) &&
          typeof(pm_total) === 'number' && !isNaN(pm_total);
    },
    set: function(value) {}
  });

  this.belongTo = function(idx) {
    if (!this.enabled || pm_id < 0 || pm_total <= pm_id) return null;
    while(idx >= pm_total) idx -= pm_total;
    return idx === pm_id;
  }
};

module.exports = PmTool;
