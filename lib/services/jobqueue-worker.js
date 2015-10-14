'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var JobQueue = require('kue');

var ElasticsearchHelper = require('../helpers/elasticsearch-helper.js');
var MongodbHelper = require('../helpers/mongodb-helper.js');
var RunhookManager = require('../services/runhook-manager.js');
var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  params = params || {};
  
  var config = params.configuration || {};
  config = lodash.pick(config, ['elasticsearch', 'redis', 'mongodb', 'runhook', 'derivedConfig']);

  var elasticsearchHelper = new ElasticsearchHelper(params);
  var mongodbHelper = new MongodbHelper(params);
  
  var runhookManager = new RunhookManager(lodash.defaultsDeep(config, {
    runhook: {
      context: {
        elasticsearch_index_url: config.derivedConfig.es_index_url,
        mongo_collection_names: config.derivedConfig.mongo_collection_names
      },
      service: {
        elasticsearchHelper: elasticsearchHelper,
        mongodbHelper: mongodbHelper
      }
    }
  }));

  self.getRunhookManager = function() {
    return runhookManager;
  };
  
  var redis_conf = config.redis;
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
      logger.trace(constx.RUNHOOK.MSG.BEGIN, operation, entity, JSON.stringify(doc));
      runhookManager.callRunhook(routine, entity, operation, doc).then(function(result) {
        logger.trace(constx.RUNHOOK.MSG.RESULT, operation, entity, JSON.stringify(doc), JSON.stringify(result));
      }).catch(function(e) {
        logger.error(constx.RUNHOOK.MSG.ERROR, operation, entity, JSON.stringify(doc), lodash.isString(e) ? e : JSON.stringify(e));
      }).finally(function() {
        logger.trace(constx.RUNHOOK.MSG.END, operation, entity, JSON.stringify(doc));
        done && done();
      });
    } else {
      logger.trace(constx.RUNHOOK.MSG.NOOP, operation, entity, JSON.stringify(doc));
      done && done();
    }
  };

  var jobQueueOfRoutine = {};
  jobQueueOfRoutine[constx.RUNHOOK.KEY.MOCKIT] = 'mockit-handling-runner';
  jobQueueOfRoutine[constx.RUNHOOK.KEY.OPLOG] = 'oplog-handling-runner';

  var jobQueueEvents = lodash.uniq(lodash.values(jobQueueOfRoutine));
  lodash.forEach(jobQueueEvents, function(event) {
    jobQueue.process(event, jobQueueProcess);
  });

  self.getJobQueue = function() {
    return jobQueue;
  };

  self.getJobQueueOfRoutine = function(routine) {
    return (jobQueueOfRoutine[routine] ? jobQueueOfRoutine[routine] : 'global-handling-runner');
  };
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
