'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var JobQueue = require('kue');

var constx = require('../utils/constx.js');

var Service = function(params) {
  params = params || {};

  var self = this;

  self.getSandboxName = function() {
    return params.sandboxname;
  };

  var loggingFactory = params.loggingFactory;
  self.logger = loggingFactory.getLogger();

  var config = params.sandboxconfig || {};
  config = lodash.pick(config, ['elasticsearch', 'redis', 'mongodb', 'runhook', 'derivedConfig']);

  var runhookManager = params.runhookManager;

  self.getRunhookManager = function() {
    return runhookManager;
  };

  var redis_conf = config.redis;
  self.logger.debug('<%s> + create JobQueue with redis config: %s', self.getSandboxName(), JSON.stringify(redis_conf));
  var jobQueue = JobQueue.createQueue({
    prefix: redis_conf.name || 'devebotjq',
    redis: {
      host: redis_conf.host,
      options: {}
    }
  });

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

  var jobQueueOfRoutine = {};
  jobQueueOfRoutine[constx.RUNHOOK.KEY.OPLOG] = 'oplog-handling-runner';
  jobQueueOfRoutine[constx.RUNHOOK.KEY.MARKUP] = 'index-handling-runner';
  jobQueueOfRoutine[constx.RUNHOOK.KEY.MOCKIT] = 'mockit-handling-runner';
  
  var jobQueueEvents = lodash.uniq(lodash.values(jobQueueOfRoutine));
  lodash.forEach(jobQueueEvents, function(event) {
    jobQueue.process(self.getSandboxName() + '-' + event, jobQueueProcess);
  });

  self.getJobQueue = function() {
    return jobQueue;
  };

  self.getJobQueueOfRoutine = function(routine) {
    var event = (jobQueueOfRoutine[routine] ? jobQueueOfRoutine[routine] : 'global-handling-runner');
    return self.getSandboxName() + '-' + event;
  };
};

Service.argumentSchema = {
  "id": "/jobqueueWorker",
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
    "runhookManager": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
