'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');

var constx = require('../utils/constx.js');
var debug = require('../utils/debug.js');

var debuglog = debug('devebot:jobqueueMaster');

var Service = function(params) {
  debuglog.isEnabled && debuglog(' + constructor start ...');

  params = params || {};

  var self = this;

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  self.logger = params.loggingFactory.getLogger();

  debuglog.isEnabled && debuglog(' - create a jobqueueMaster instance in sandbox <%s>', self.getSandboxName());

  self.enqueueJob = function(routine, entity, operation, document, inspectors) {
    var promisee = function(done) {
      inspectors = inspectors || {};
      var opTimestamp = Date.now();

      var jobQueueName = params.jobqueueFactory.getJobQueueOfRoutine(routine);
      var job = params.jobqueueFactory.getJobQueue().create(jobQueueName, {
        routine: routine,
        entity: entity,
        operation: operation,
        optimestamp: opTimestamp,
        document: document
      });

      job.on('enqueue', function(queueName) {
        self.logger.trace(constx.JOB.MSG_ON_EVENT['enqueue'],
            self.getSandboxName(), routine, operation, opTimestamp, entity);
        self.logger.debug(constx.JOB.MSG_ON_EVENT['enqueue_debug'],
            self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(document), JSON.stringify(arguments));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.STARTED,
            message: constx.WEBSOCKET.MSG_ON.STARTED
          }));
        }
      }).on('promotion', function(unknown) {
        self.logger.trace(constx.JOB.MSG_ON_EVENT['promotion'],
            self.getSandboxName(), routine, operation, opTimestamp, entity);
        self.logger.debug(constx.JOB.MSG_ON_EVENT['promotion_debug'],
            self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(document), JSON.stringify(arguments));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.PROMOTION,
            message: constx.WEBSOCKET.MSG_ON.PROMOTION
          }));
        }
      }).on('progress', function(progress, data) {
        self.logger.debug(constx.JOB.MSG_ON_EVENT['progress'],
            self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(document), progress, JSON.stringify(data));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.PROGRESS,
            message: constx.WEBSOCKET.MSG_ON.PROGRESS,
            progress: progress,
            data: data
          }));
        }
      }).on('failed attempt', function(errorMessage, doneAttempts) {
        self.logger.error(constx.JOB.MSG_ON_EVENT['failed'],
            self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(document), JSON.stringify(errorMessage));
        if (inspectors.ws && inspectors.notifyFailure) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.FAILURE,
            message: constx.WEBSOCKET.MSG_ON.FAILURE,
            error: errorMessage
          }));
        }
      }).on('failed', function(errorMessage) {
        self.logger.error(constx.JOB.MSG_ON_EVENT['failed'],
            self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(document), JSON.stringify(errorMessage));
        if (inspectors.ws && inspectors.notifyFailure) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.FAILURE,
            message: constx.WEBSOCKET.MSG_ON.FAILURE,
            error: errorMessage
          }));
        }
        done(errorMessage, null);
      }).on('complete', function(result) {
        self.logger.trace(constx.JOB.MSG_ON_EVENT['complete'],
            self.getSandboxName(), routine, operation, opTimestamp, entity);
        self.logger.debug(constx.JOB.MSG_ON_EVENT['complete_debug'],
            self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(document), JSON.stringify(result));
        if (inspectors.ws && inspectors.notifySuccess) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.SUCCESS,
            message: constx.WEBSOCKET.MSG_ON.SUCCESS,
            result: result
          }));
        }
        done(null, result);
      }).on('remove', function(unknown) {
        self.logger.trace(constx.JOB.MSG_ON_EVENT['remove'],
            self.getSandboxName(), routine, operation, opTimestamp, entity);
        self.logger.debug(constx.JOB.MSG_ON_EVENT['remove_debug'],
            self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(document), JSON.stringify(arguments));
        if (inspectors.ws) {
          inspectors.ws.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.REMOVE,
            message: constx.WEBSOCKET.MSG_ON.REMOVE
          }));
        }
      });

      job.removeOnComplete(true).save();
    };
    return Promise.promisify(promisee)();
  };

  self.getRunhookEntities = function(routine) {
    return params.runhookManager.getRunhookEntities(routine);
  };

  self.getRunhookOperations = function(routine, entity) {
    return params.runhookManager.getRunhookOperations(routine, entity);
  };

  debuglog.isEnabled && debuglog(' - jobqueueMaster instance in sandbox <%s> has been created', self.getSandboxName());

  debuglog.isEnabled && debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "jobqueueMaster",
  "type": "object",
  "properties": {
    "sandboxName": {
      "type": "string"
    },
    "loggingFactory": {
      "type": "object"
    },
    "jobqueueFactory": {
      "type": "object"
    },
    "runhookManager": {
      "type": "object"
    }
  }
};

module.exports = Service;
