'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var constx = require('../utils/constx.js');
var debugx = require('../utils/debug.js')('devebot:jobqueue:worker');
var JobqueueCommon = require('./jobqueue-common.js');

var Service = function(params) {
  var self = this;
  params = params || {};
  JobqueueCommon.call(self, params);

  debugx.enabled && debugx(' + constructor start ...');
  debugx.enabled && debugx(' - create a jobqueueWorker instance in sandbox <%s>', self.getSandboxName());

  var runhookManager = params.runhookManager;

  var jobQueue = self.getJobQueue();

  var jobQueueProcess = function (job, done) {
    var runhook = job.data;
    var runhook_log = lodash.omit(runhook, ['document', 'options', 'payload']);

    if (runhookManager.isAvailable(runhook)) {
      if (self.logger.isLevelEnabled('trace')) {
        self.logger.trace('jobqueueWorker on sandbox[%s] - runhook: %s - invoke',
          self.getSandboxName(), JSON.stringify(runhook_log));
      }
      runhookManager.process(runhook).then(function(result) {
        if (self.logger.isLevelEnabled('trace')) {
          self.logger.trace('jobqueueWorker on sandbox[%s] - runhook: %s - return: %s',
            self.getSandboxName(), JSON.stringify(runhook_log), JSON.stringify(result));
        }
        done && done(null, result);
      }).catch(function(error) {
        if (self.logger.isLevelEnabled('error')) {
          self.logger.error('jobqueueWorker on sandbox[%s] - runhook: %s - error: %s',
            self.getSandboxName(), JSON.stringify(runhook_log), JSON.stringify(error));
        }
        done && done(error, null);
      });
    } else {
      if (self.logger.isLevelEnabled('trace')) {
        self.logger.trace('jobqueueWorker on sandbox[%s] - runhook: %s - not found',
          self.getSandboxName(), JSON.stringify(runhook_log));
      }
      done && done(null, {});
    }
  };

  var jobQueueOfRoutine = self.getJobQueueMappings();

  var jobQueueEvents = lodash.pull(lodash.uniq(lodash.values(jobQueueOfRoutine)), 'jobqueue-global');
  lodash.forEach(jobQueueEvents, function(event) {
    jobQueue.process(event + '-' + self.getSandboxName(), jobQueueProcess);
  });
  jobQueue.process('jobqueue-global' + '-' + self.getSandboxName(), jobQueueProcess);

  debugx.enabled && debugx(' - jobqueueWorker instance in sandbox <%s> has been created', self.getSandboxName());
  debugx.enabled && debugx(' - constructor has finished');
};

util.inherits(Service, JobqueueCommon);

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
    "loggingFactory": {
      "type": "object"
    },
    "runhookManager": {
      "type": "object"
    }
  }
};

module.exports = Service;
