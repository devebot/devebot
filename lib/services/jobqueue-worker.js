'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var JobQueue = require('kue');

var RunhookManager = require('../services/runhook-manager.js');
var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  params = params || {};
  
  var self = this;
  
  self.getSandboxName = function() {
    return params.contextname;
  };
  
  var config = params.configuration || {};
  config = lodash.pick(config, ['elasticsearch', 'redis', 'mongodb', 'runhook', 'derivedConfig']);

  var runhookManager = new RunhookManager(params);

  self.getRunhookManager = function() {
    return runhookManager;
  };
  
  var redis_conf = config.redis;
  logger.trace('<%s> + create JobQueue with redis config: %s', self.getSandboxName(), JSON.stringify(redis_conf));
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
    var doc = job.data.document;

    if (runhookManager.isRunhookAvailable(routine, entity, operation)) {
      logger.trace(constx.RUNHOOK.MSG.BEGIN, self.getSandboxName(), routine, operation, entity, JSON.stringify(doc));
      runhookManager.callRunhook(routine, entity, operation, doc).then(function(result) {
        logger.trace(constx.RUNHOOK.MSG.RESULT, self.getSandboxName(), routine, operation, entity, JSON.stringify(doc), JSON.stringify(result));
        done && done(null, result);
      }).catch(function(error) {
        logger.error(constx.RUNHOOK.MSG.ERROR, self.getSandboxName(), routine, operation, entity, JSON.stringify(doc), JSON.stringify(error));
        done && done(error, null);
      }).finally(function() {
        logger.trace(constx.RUNHOOK.MSG.END, self.getSandboxName(), routine, operation, entity, JSON.stringify(doc));
      });
    } else {
      logger.trace(constx.RUNHOOK.MSG.NOOP, self.getSandboxName(), routine, operation, entity, JSON.stringify(doc));
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

util.inherits(Service, events.EventEmitter);

module.exports = Service;
