'use strict';

var events = require('events');
var util = require('util');
var MongoOplog = require('mongo-oplog');
var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  params = params || {};
  
  var self = this;
  
  self.getSandboxName = function() {
    return params.sandboxname;
  };
  
  var config = params.configuration;
  var jobqueueAdapter = params.jobqueueAdapter;
  
  var mongo_conf = config.mongodb;
  var mongo_url = util.format('mongodb://%s:%s/local', mongo_conf.host, mongo_conf.port);
  
  var oplog = MongoOplog(mongo_url);
  
  oplog.on('end', function () {
    logger.trace('<%s> * MongoDB oplog stream ended', self.getSandboxName());
  });
  
  oplog.on('error', function (error) {
    logger.error('<%s> * MongoDB oplog has error: %s', self.getSandboxName(), JSON.stringify(error));
  });

  var runhookEntities = jobqueueAdapter.getRunhookEntities(constx.RUNHOOK.KEY.OPLOG) || [];
  runhookEntities.forEach(function(entity) {
    var opfilter = oplog.filter(util.format('%s.%s', mongo_conf.name, entity));
    var runhookOperations = jobqueueAdapter.getRunhookOperations(constx.RUNHOOK.KEY.OPLOG, entity) || [];
    runhookOperations.forEach(function(operation) {
      opfilter.on(operation, (function(jobqueueAdapter, entity, operation) {
        return function(doc) {
          jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.OPLOG, entity, operation, doc).then(function() {
            logger.trace('<%s> - MongodbTrigger pass the Job', self.getSandboxName());
          }, function() {
            logger.error('<%s> - MongodbTrigger fail the Job', self.getSandboxName());
          });
        };
      })(jobqueueAdapter, entity, operation));
    });
  });
  
  self.getOplog = function() {
    return oplog; 
  };
};

Service.argumentSchema = {
  "id": "/mongodbTrigger",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "configuration": {
      "type": "object"
    },
    "jobqueueAdapter": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

Service.prototype.start = function() {
  var self = this;
  self.getOplog().tail(function() {
    logger.trace('<%s> - MongodbTrigger is started', self.getSandboxName());
    self.emit('started');
  });
};

Service.prototype.stop = function() {
  var self = this;
  self.getOplog().stop(function() {
    logger.trace('<%s> - MongodbTrigger is stopped', self.getSandboxName());
    self.emit('stopped');
  });
};

module.exports = Service;
