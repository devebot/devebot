'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var MongoOplog = require('mongo-oplog');
var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  params = params || {};

  var config = params.configuration;
  var jobqueueAdapter = params.jobqueueAdapter;
  
  var mongo_conf = config.mongodb;
  var mongo_url = util.format('mongodb://%s:%s/local', mongo_conf.host, mongo_conf.port);
  
  var oplog = MongoOplog(mongo_url);
  
  oplog.on('end', function () {
    logger.trace('MongoDB oplog stream ended');
  });
  
  oplog.on('error', function (error) {
    logger.error('MongoDB oplog has error: %s', JSON.stringify(error));
  });

  var runhookEntities = jobqueueAdapter.getRunhookEntities(constx.RUNHOOK.KEY.OPLOG) || [];
  runhookEntities.forEach(function(entity) {
    var opfilter = oplog.filter(util.format('%s.%s', mongo_conf.name, entity));
    var runhookOperations = jobqueueAdapter.getRunhookOperations(constx.RUNHOOK.KEY.OPLOG, entity) || [];
    runhookOperations.forEach(function(operation) {
      opfilter.on(operation, function(doc) {
        jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.OPLOG, entity, operation, doc);
      });
    });
  });
  
  self.getOplog = function() {
    return oplog; 
  };
};

util.inherits(Service, events.EventEmitter);

Service.prototype.start = function() {
  var self = this;
  self.getOplog().tail(function() {
    logger.trace(' - MongodbTrigger is started');
    self.emit('started');
  });
};

Service.prototype.stop = function() {
  var self = this;
  self.getOplog().stop(function() {
    logger.trace(' - MongodbTrigger is stopped');
    self.emit('stopped');
  });
};

module.exports = Service;
