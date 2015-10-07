'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');

var JobqueueWorker = require('../services/jobqueue-worker.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  params = params || {};
  
  logger.trace(' * create a jobqueue-adapter instance with parameters %s', 
      JSON.stringify(params));
  
  var jobqueueWorker = new JobqueueWorker(params);

  self.enqueueJob = function(routine, entity, operation, document) {
    var jobQueueName = jobqueueWorker.getJobQueueOfRoutine(routine);
    var job = jobqueueWorker.getJobQueue().create(jobQueueName, {
      routine: routine,
      entity: entity,
      operation: operation,
      document: document
    });
    job.save();
  };

  self.getRunhookEntities = function(type) {
    return jobqueueWorker.getRunhookManager().getRunhookEntities(type);
  };
  
  self.getRunhookOperations = function(type, entity) {
    return jobqueueWorker.getRunhookManager().getRunhookOperations(type, entity);
  };
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
