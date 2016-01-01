'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var MongoOplog = require('mongo-oplog');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var logger = require('logdapter').defaultLogger;

var Service = function(params) {
  params = params || {};
  
  var self = this;
  
  self.getSandboxName = function() {
    return params.sandboxname;
  };
  
  var loggingFactory = params.loggingFactory;
  self.logger = loggingFactory.getLogger();
  
  var config = params.sandboxconfig;
  var jobqueueAdapter = params.jobqueueAdapter;
  
  var mongo_conf = config.mongodb;
  var mongo_oplog_conf = config.mongodb.oplog || {};

  var mongo_connection_info = {
    host: mongo_conf.host,
    port: mongo_conf.port,
    name: mongo_oplog_conf.name || 'local',
    username: mongo_oplog_conf.username || mongo_conf.username,
    password: mongo_oplog_conf.password || mongo_conf.password,
    authSource: mongo_oplog_conf.authSource
  };
  
  var mongo_url = chores.buildMongodbUrl(mongo_connection_info);

  var oplog = MongoOplog(mongo_url);
  
  oplog.on('end', function () {
    self.logger.trace('<%s> * MongoDB oplog stream ended', self.getSandboxName());
  });
  
  oplog.on('error', function (error) {
    self.logger.error('<%s> * MongoDB oplog has error: %s', self.getSandboxName(), JSON.stringify(error));
  });

  var runhookEntities = jobqueueAdapter.getRunhookEntities(constx.RUNHOOK.KEY.OPLOG) || [];
  runhookEntities.forEach(function(entity) {
    var opfilter = oplog.filter(util.format('%s.%s', mongo_conf.name, entity));
    var runhookOperations = jobqueueAdapter.getRunhookOperations(constx.RUNHOOK.KEY.OPLOG, entity) || [];
    runhookOperations.forEach(function(operation) {
      opfilter.on(operation, (function(jobqueueAdapter, entity, operation) {
        return function(doc) {
          jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.OPLOG, entity, operation, doc).then(function() {
            self.logger.debug('<%s> - MongodbTrigger pass the Job', self.getSandboxName());
          }, function() {
            self.logger.debug('<%s> - MongodbTrigger fail the Job', self.getSandboxName());
          });
        };
      })(jobqueueAdapter, entity, operation));
    });
  });
  
  self.getOplog = function() {
    return oplog; 
  };
  
  self.getServiceInfo = function() {
    var conf = lodash.assign(lodash.clone(mongo_connection_info), { password: '***' });
    return {
      connection_info: conf,
      url: chores.buildMongodbUrl(conf)
    };
  };
};

Service.argumentSchema = {
  "id": "/mongodbTrigger",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "sandboxconfig": {
      "type": "object"
    },
    "loggingFactory": {
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
    self.logger.trace('<%s> - MongodbTrigger is started', self.getSandboxName());
    self.emit('started');
  });
};

Service.prototype.stop = function() {
  var self = this;
  self.getOplog().stop(function() {
    self.logger.trace('<%s> - MongodbTrigger is stopped', self.getSandboxName());
    self.emit('stopped');
  });
};

module.exports = Service;
