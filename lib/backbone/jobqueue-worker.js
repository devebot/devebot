'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var Service = function(params) {
  var self = this;
  params = params || {};

  self.getSandboxName = function() {
    return params.sandboxName;
  };

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: params.sandboxName
  }).stringify({
    tags: [ 'constructor-begin' ],
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
    tags: [ 'constructor-end' ],
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
