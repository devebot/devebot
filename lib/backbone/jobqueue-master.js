'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');
var lodash = require('lodash');
var constx = require('../utils/constx.js');
var debug = require('../utils/debug.js');
var debugx = debug('devebot:jobqueue:master');
var JobqueueCommon = require('./jobqueue-factory.js');

var Service = function(params) {
  var self = this;
  params = params || {};
  JobqueueCommon.call(self, params);

  debugx.enabled && debugx(' + constructor start ...');
  debugx.enabled && debugx(' - create a jobqueueMaster instance in sandbox <%s>', self.getSandboxName());

  self.enqueueJob = function(runhook, context) {
    runhook = runhook || {};
    context = context || {};
    var outlet = context.outlet || context.ws || { send: function() {} };

    var routine = runhook.routine;
    var opTimestamp = runhook.optimestamp = Date.now();
    var runhook_log = lodash.emit(runhook, ['document', 'payload']);

    var promisee = function(done) {
      var jobQueueName = self.getJobQueueOfRoutine(routine);
      var job = self.getJobQueue().create(jobQueueName, runhook);

      job.on('enqueue', function(queueName) {
        if (self.logger.isLevelEnabled('trace')) {
          self.logger.trace('jobqueueMaster on sandbox[%s] - runhook: %s - enqueue',
            self.getSandboxName(), JSON.stringify(runhook_log));
        }
        if (self.logger.isLevelEnabled('debug')) {
          self.logger.debug('jobqueueMaster on sandbox[%s] - runhook: %s - enqueue - arguments: %s',
            self.getSandboxName(), JSON.stringify(runhook), JSON.stringify(arguments));
        }
        if (outlet) {
          outlet.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.STARTED,
            message: constx.WEBSOCKET.MSG_ON.STARTED
          }));
        }
      }).on('promotion', function(unknown) {
        if (self.logger.isLevelEnabled('trace')) {
          self.logger.trace('jobqueueMaster on sandbox[%s] - runhook: %s - promotion',
            self.getSandboxName(), JSON.stringify(runhook_log));
        }
        if (self.logger.isLevelEnabled('debug')) {
          self.logger.debug('jobqueueMaster on sandbox[%s] - runhook: %s - promotion - arguments: %s',
            self.getSandboxName(), JSON.stringify(runhook), JSON.stringify(arguments));
        }
        if (outlet) {
          outlet.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.PROMOTION,
            message: constx.WEBSOCKET.MSG_ON.PROMOTION
          }));
        }
      }).on('progress', function(progress, data) {
        if (self.logger.isLevelEnabled('debug')) {
          self.logger.debug('jobqueueMaster on sandbox[%s] - runhook: %s - progress: %s',
            self.getSandboxName(), JSON.stringify(runhook_log), progress);
        }
        if (outlet) {
          outlet.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.PROGRESS,
            message: constx.WEBSOCKET.MSG_ON.PROGRESS,
            progress: progress,
            data: data
          }));
        }
      }).on('failed attempt', function(errorMessage, doneAttempts) {
        if (self.logger.isLevelEnabled('error')) {
          self.logger.error('jobqueueMaster on sandbox[%s] - runhook: %s - failed attempt - error: %s',
            self.getSandboxName(), JSON.stringify(runhook_log), JSON.stringify(errorMessage));
        }
        if (outlet && context.notifyFailure) {
          outlet.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.FAILURE,
            message: constx.WEBSOCKET.MSG_ON.FAILURE,
            error: errorMessage
          }));
        }
      }).on('failed', function(errorMessage) {
        if (self.logger.isLevelEnabled('error')) {
          self.logger.error('jobqueueMaster on sandbox[%s] - runhook: %s - failed - error: %s',
            self.getSandboxName(), JSON.stringify(runhook_log), JSON.stringify(errorMessage));
        }
        if (outlet && context.notifyFailure) {
          outlet.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.FAILURE,
            message: constx.WEBSOCKET.MSG_ON.FAILURE,
            error: errorMessage
          }));
        }
        done(errorMessage, null);
      }).on('complete', function(result) {
        if (self.logger.isLevelEnabled('trace')) {
          self.logger.trace('jobqueueMaster on sandbox[%s] - runhook: %s - complete',
            self.getSandboxName(), JSON.stringify(runhook_log));
        }
        if (self.logger.isLevelEnabled('debug')) {
          self.logger.debug('jobqueueMaster on sandbox[%s] - runhook: %s - complete - result: %s',
            self.getSandboxName(), JSON.stringify(runhook), JSON.stringify(trace));
        }
        if (outlet && context.notifySuccess) {
          outlet.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.SUCCESS,
            message: constx.WEBSOCKET.MSG_ON.SUCCESS,
            result: result
          }));
        }
        done(null, result);
      }).on('remove', function(unknown) {
        if (self.logger.isLevelEnabled('trace')) {
          self.logger.trace('jobqueueMaster on sandbox[%s] - runhook: %s - removed',
            self.getSandboxName(), JSON.stringify(runhook_log));
        }
        if (self.logger.isLevelEnabled('debug')) {
          self.logger.debug('jobqueueMaster on sandbox[%s] - runhook: %s - removed - arguments: %s',
            self.getSandboxName(), JSON.stringify(runhook), JSON.stringify(arguments));
        }
        if (outlet) {
          outlet.send(JSON.stringify({
            state: constx.WEBSOCKET.STATE.REMOVE,
            message: constx.WEBSOCKET.MSG_ON.REMOVE
          }));
        }
      });

      job.removeOnComplete(true).save();
    };
    return Promise.promisify(promisee)();
  };

  debugx.enabled && debugx(' - jobqueueMaster instance in sandbox <%s> has been created', self.getSandboxName());
  debugx.enabled && debugx(' - constructor has finished');
};

util.inherits(Service, JobqueueCommon);

Service.argumentSchema = {
  "id": "jobqueueMaster",
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
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = Service;
