'use strict';

var events = require('events');
var util = require('util');

var Jobdapter = require('jobdapter');
var lodash = require('lodash');

var debug = require('../utils/debug.js');
var debuglog = debug('devebot:jobqueueFactory');

var Service = function(params) {
  debuglog(' + constructor start ...');
  params = params || {};

  var self = this;

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  var redis_conf = lodash.get(params, ['sandboxConfig', 'devebot', 'redis'], {});

  if (debuglog.isEnabled) {
    debuglog(' - jobqueue in <%s> with redis config: %s', self.getSandboxName(), util.inspect(redis_conf));  
  }

  var jobdapter = new Jobdapter({ redis: redis_conf });

  lodash.assign(this, lodash.mapValues(lodash.pick(jobdapter, [
    'getJobQueue', 'getServiceInfo', 'getServiceHelp'
  ]), function(item) {
    return item.bind(jobdapter);
  }));

  debuglog(' - constructor has finished');
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
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
