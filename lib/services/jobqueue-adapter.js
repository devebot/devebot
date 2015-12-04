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
  
  logger.trace(' * create a jobqueue-adapter instance in context <%s>', params.contextname);
  
  var ctxname = params.contextname;
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
      
      job.on('enqueue', function(queueName) {
        logger.trace(constx.JOB.MSG_ON_EVENT['enqueue'], 
            ctxname, routine, operation, entity, JSON.stringify(document), JSON.stringify(arguments));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.STARTED,
            message: constx.WEBSOCKET.MSG_ON.STARTED
          }));
        }
      }).on('progress', function(progress, data) {
        logger.trace(constx.JOB.MSG_ON_EVENT['progress'], 
            ctxname, routine, operation, entity, JSON.stringify(document), progress, JSON.stringify(data));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.PROGRESS,
            message: constx.WEBSOCKET.MSG_ON.PROGRESS,
            progress: progress,
            data: data
          }));
        }
      }).on('failed attempt', function(errorMessage, doneAttempts) {
        logger.trace(constx.JOB.MSG_ON_EVENT['failed'], 
            ctxname, routine, operation, entity, JSON.stringify(document), JSON.stringify(errorMessage));
        if (inspectors.ws && inspectors.notifyFailure) {
          inspectors.ws.send(JSON.stringify({ 
            state: constx.WEBSOCKET.STATE.FAILURE,
            message: constx.WEBSOCKET.MSG_ON.FAILURE,
            error: errorMessage
          }));
        }
      }).on('failed', function(errorMessage) {
        logger.trace(constx.JOB.MSG_ON_EVENT['failed'], 
            ctxname, routine, operation, entity, JSON.stringify(document), JSON.stringify(errorMessage));
        if (inspectors.ws && inspectors.notifyFailure) {
          inspectors.ws.send(JSON.stringify({ 
            state: constx.WEBSOCKET.STATE.FAILURE,
            message: constx.WEBSOCKET.MSG_ON.FAILURE,
            error: errorMessage
          }));
        }
        done(errorMessage, null);
      }).on('complete', function(result) {
        logger.trace(constx.JOB.MSG_ON_EVENT['complete'], 
            ctxname, routine, operation, entity, JSON.stringify(document), JSON.stringify(result));
        if (inspectors.ws && inspectors.notifySuccess) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.SUCCESS,
            message: constx.WEBSOCKET.MSG_ON.SUCCESS,
            result: result
          }));
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
  
  logger.trace(' * create a jobqueue-adapter instance done!');
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
