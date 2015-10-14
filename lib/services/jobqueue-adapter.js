'use strict';

var events = require('events');
var util = require('util');

var JobqueueWorker = require('../services/jobqueue-worker.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  params = params || {};
  
  var config = params.configuration || {};
  
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

  self.getRunhookEntities = function(routine) {
    return jobqueueWorker.getRunhookManager().getRunhookEntities(routine);
  };
  
  self.getRunhookOperations = function(routine, entity) {
    return jobqueueWorker.getRunhookManager().getRunhookOperations(routine, entity);
  };
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
