'use strict';

var events = require('events');
var util = require('util');

var Jobdapter = require('jobdapter');
var lodash = require('lodash');

var debug = require('../utils/debug.js');
var debugx = debug('devebot:jobqueue:common');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor start ...');
  params = params || {};

  var self = this;

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  self.logger = params.loggingFactory.getLogger();

  var jqCfg = lodash.get(params, ['profileConfig', 'devebot', 'jobqueue'], {});

  Object.defineProperty(self, 'enabled', {
    get: function() { return jqCfg.enabled !== false; },
    set: function(value) {}
  });

  if (self.enabled) {
    var engine_hash = {};
    var engine_name = jqCfg.default || 'redis';
    var engine_list = jqCfg.engines || [];
    lodash.forEach(engine_list, function(engine_item) {
      engine_hash[engine_item.name] = engine_item.config;
    });
    debugx.enabled && debugx(' - Jobqueue engines: %s', JSON.stringify(engine_hash));

    var redis_conf = engine_hash[engine_name] || { host: '127.0.0.1', port: 6379, name: 'devebotjq' };
    debugx.enabled && debugx(' - jobqueue in <%s> with redis config: %s', self.getSandboxName(), util.inspect(redis_conf));

    var jobdapter = new Jobdapter({ redis: redis_conf });
    lodash.assign(this, lodash.mapValues(lodash.pick(jobdapter, [
      'getJobQueue', 'getServiceInfo', 'getServiceHelp'
    ]), function(item) {
      return item.bind(jobdapter);
    }));
  }

  var jobQueueOfRoutine = jqCfg.mappings || {};

  self.getJobQueueMappings = function() {
    return jobQueueOfRoutine;
  };

  self.getJobQueueOfRoutine = function(name) {
    var event = (jobQueueOfRoutine[name] ? jobQueueOfRoutine[name] : 'jobqueue-global');
    return event + '-' + self.getSandboxName();
  };

  debugx.enabled && debugx(' - constructor has finished');
};

module.exports = Service;
