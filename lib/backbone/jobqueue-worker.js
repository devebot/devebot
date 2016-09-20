'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');

var constx = require('../utils/constx.js');
var debug = require('../utils/debug.js');

var debuglog = debug('devebot:jobqueueWorker');

var Service = function(params) {
  debuglog.isEnabled && debuglog(' + constructor start ...');
  Service.super_.apply(this);

  params = params || {};

  var self = this;

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  self.logger = params.loggingFactory.getLogger();

  var runhookManager = params.runhookManager;

  self.getRunhookManager = function() {
    return runhookManager;
  };

  var jobQueue = params.jobqueueFactory.getJobQueue();

  var jobQueueProcess = function (job, done) {
    var routine = job.data.routine;
    var entity = job.data.entity;
    var operation = job.data.operation;
    var opTimestamp = job.data.optimestamp;
    var doc = job.data.document;

    if (runhookManager.isRunhookAvailable(routine, entity, operation)) {
      self.logger.trace(constx.RUNHOOK.MSG.BEGIN, self.getSandboxName(), routine, operation, opTimestamp, entity);
      self.logger.debug(constx.RUNHOOK.MSG.DATA, self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(doc));
      runhookManager.callRunhook(routine, entity, operation, doc).then(function(result) {
        self.logger.trace(constx.RUNHOOK.MSG.RESULT, self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(result));
        done && done(null, result);
      }).catch(function(error) {
        self.logger.error(constx.RUNHOOK.MSG.ERROR, self.getSandboxName(), routine, operation, opTimestamp, entity, JSON.stringify(doc), JSON.stringify(error));
        done && done(error, null);
      }).finally(function() {
        self.logger.debug(constx.RUNHOOK.MSG.END, self.getSandboxName(), routine, operation, opTimestamp, entity);
      });
    } else {
      self.logger.trace(constx.RUNHOOK.MSG.NOOP, self.getSandboxName(), routine, operation, opTimestamp, entity);
      done && done(null, {});
    }
  };

  var jobQueueOfRoutine = lodash.get(params, 'generalConfig.jobqueue.mappings', {});
  var jobQueueEvents = lodash.pull(lodash.uniq(lodash.values(jobQueueOfRoutine)), 'jobqueue-global');
  lodash.forEach(jobQueueEvents, function(event) {
    jobQueue.process(event + '-' + self.getSandboxName(), jobQueueProcess);
  });
  jobQueue.process('jobqueue-global' + '-' + self.getSandboxName(), jobQueueProcess);

  self.getJobQueue = function() {
    return jobQueue;
  };

  self.getJobQueueOfRoutine = function(routine) {
    var event = (jobQueueOfRoutine[routine] ? jobQueueOfRoutine[routine] : 'jobqueue-global');
    return event + '-' + self.getSandboxName();
  };

  debuglog.isEnabled && debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "jobqueueWorker",
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

util.inherits(Service, events.EventEmitter);

module.exports = Service;
