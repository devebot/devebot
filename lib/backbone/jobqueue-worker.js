'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var Service = function(params) {
  var self = this;
  params = params || {};

  var getSandboxName = function() {
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

  var runhookManager = params.runhookManager;

  this.jobQueueProcess = function (job, done) {
    var runhook = job.data;
    var runhook_log = lodash.omit(runhook, ['document', 'options', 'payload']);
    var progressMeter = runhookManager.createProgressMeter({ job: job });

    if (runhookManager.isAvailable(runhook)) {
      LX.has('trace') && LX.log('trace', 'jobqueueWorker on sandbox[%s] - runhook: %s - invoke',
        getSandboxName(), JSON.stringify(runhook_log));
      runhookManager.process(runhook, progressMeter).then(function(result) {
        LX.has('trace') && LX.log('trace', 'jobqueueWorker on sandbox[%s] - runhook: %s - return: %s',
          getSandboxName(), JSON.stringify(runhook_log), JSON.stringify(result));
        done && done(null, result);
      }).catch(function(error) {
        LX.has('error') && LX.log('error', 'jobqueueWorker on sandbox[%s] - runhook: %s - error: %s',
          getSandboxName(), JSON.stringify(runhook_log), JSON.stringify(error));
        done && done(error, null);
      });
    } else {
      LX.has('trace') && LX.log('trace', 'jobqueueWorker on sandbox[%s] - runhook: %s - not found',
        getSandboxName(), JSON.stringify(runhook_log));
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
