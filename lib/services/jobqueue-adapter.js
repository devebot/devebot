'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');
var JobqueueWorker = require('../services/jobqueue-worker.js');

var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  params = params || {};
  
  logger.trace(' * create a jobqueue-adapter instance with parameters %s', 
      JSON.stringify(params));
  
  var config = params.configuration || {};
  var jobqueueWorker = new JobqueueWorker(params);

  self.enqueueJob = function(routine, entity, operation, document, inspectors) {
    var promisee = function(done) {
      inspectors = inspectors || {};
      
      var jobQueueName = jobqueueWorker.getJobQueueOfRoutine(routine);
      var job = jobqueueWorker.getJobQueue().create(jobQueueName, {
        routine: routine,
        entity: entity,
        operation: operation,
        document: document
      });
      
      job.on('enqueue', function(params) {
        logger.trace(constx.JOB.MSG_ON_EVENT['enqueue'], 
            routine, operation, entity, JSON.stringify(document), JSON.stringify(arguments));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({ state: 'enqueue' }));
        }
      }).on('progress', function(progress, data) {
        logger.trace(constx.JOB.MSG_ON_EVENT['progress'], 
            routine, operation, entity, JSON.stringify(document), progress, JSON.stringify(data));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({ state: 'progress', progress: progress, data: data }));
        }
      }).on('failed attempt', function(errorMessage, doneAttempts) {
        logger.trace(constx.JOB.MSG_ON_EVENT['failed'], 
            routine, operation, entity, JSON.stringify(document), JSON.stringify(errorMessage));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({ state: 'failed', error: errorMessage }));
        }
      }).on('failed', function(errorMessage) {
        logger.trace(constx.JOB.MSG_ON_EVENT['failed'], 
            routine, operation, entity, JSON.stringify(document), JSON.stringify(errorMessage));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({ state: 'failed', error: errorMessage }));
        }
        done(errorMessage, null);
      }).on('complete', function(result) {
        logger.trace(constx.JOB.MSG_ON_EVENT['complete'], 
            routine, operation, entity, JSON.stringify(document), JSON.stringify(result));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({ state: 'complete', result: result }));
        }
        done(null, result);
      });

      job.save();
    };
    return Promise.promisify(promisee)();
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
