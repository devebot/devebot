'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var constx = require('../utils/constx.js');
var LogAdapter = require('logolite').LogAdapter;
var LX = LogAdapter.getLogger({ scope: 'devebot:jobqueue:worker' });
var LogTracer = require('logolite').LogTracer;

var Service = function(params) {
  var self = this;
  params = params || {};

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  var LT = LogTracer.ROOT
      .branch({ key: 'serviceName', value: 'jobqueueWorker' })
      .branch({ key: 'serviceId', value: LogTracer.getLogID() });

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: params.sandboxName
  }).stringify({
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  self.logger = params.loggingFactory.getLogger();

  var runhookManager = params.runhookManager;

  this.jobQueueProcess = function (job, done) {
    var runhook = job.data;
    var runhook_log = lodash.omit(runhook, ['document', 'options', 'payload']);
    var progressMeter = runhookManager.createProgressMeter({ job: job });

    if (runhookManager.isAvailable(runhook)) {
      if (self.logger.isLevelEnabled('trace')) {
        self.logger.trace('jobqueueWorker on sandbox[%s] - runhook: %s - invoke',
          self.getSandboxName(), JSON.stringify(runhook_log));
      }
      runhookManager.process(runhook, progressMeter).then(function(result) {
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

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    text: ' - constructor has finished'
  }));
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
    "loggingFactory": {
      "type": "object"
    },
    "runhookManager": {
      "type": "object"
    }
  }
};

module.exports = Service;
