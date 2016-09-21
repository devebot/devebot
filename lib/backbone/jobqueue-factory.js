'use strict';

var events = require('events');
var util = require('util');

var Jobdapter = require('jobdapter');
var lodash = require('lodash');

var debug = require('../utils/debug.js');
var debuglog = debug('devebot:jobqueueFactory');

var Service = function(params) {
  debuglog.isEnabled && debuglog(' + constructor start ...');
  params = params || {};

  var self = this;

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  var jobQueueOfRoutine = lodash.get(params, 'generalConfig.jobqueue.mappings', {});

  self.getJobQueueMappings = function() {
    return jobQueueOfRoutine;
  };

  self.getJobQueueOfRoutine = function(routine) {
    var event = (jobQueueOfRoutine[routine] ? jobQueueOfRoutine[routine] : 'jobqueue-global');
    return event + '-' + self.getSandboxName();
  };

  var engine_hash = {};
  var engine_name = lodash.get(params, ['sandboxConfig', 'devebot', 'jobqueue', 'default'], 'redis');
  var engine_list = lodash.get(params, ['sandboxConfig', 'devebot', 'jobqueue', 'engines'], []);
  lodash.forEach(engine_list, function(engine_item) {
    engine_hash[engine_item.name] = engine_item.config;
  });

  debuglog.isEnabled && debuglog(' - Jobqueue engines: %s', JSON.stringify(engine_hash));

  var redis_conf = engine_hash[engine_name] || { host: '127.0.0.1', port: 6379, name: 'devebotjq' };

  debuglog.isEnabled && debuglog(' - jobqueue in <%s> with redis config: %s', self.getSandboxName(), util.inspect(redis_conf));

  var jobdapter = new Jobdapter({ redis: redis_conf });

  lodash.assign(this, lodash.mapValues(lodash.pick(jobdapter, [
    'getJobQueue', 'getServiceInfo', 'getServiceHelp'
  ]), function(item) {
    return item.bind(jobdapter);
  }));

  debuglog.isEnabled && debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "jobqueueFactory",
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
    "generalConfig": {
      "type": "object"
    }
  }
};

module.exports = Service;
