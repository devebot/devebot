'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var JobQueue = require('kue');

var ElasticsearchHelper = require('../helpers/elasticsearch-helper.js');
var MongodbHelper = require('../helpers/mongodb-helper.js');
var RunhookManager = require('../services/runhook-manager.js');
var logger = require('../utils/logger.js');

var OPLOG_KEY = 'oplog';
var OPLOG_MSG = {
  'BEGIN': ' - start to %s an item of %s document: %s',
  'RESULT': ' - > %s the item %s document [%s], oplog result: %s',
  'ERROR': ' - > %s the item %s document [%s], oplog error: %s',
  'END': ' - > finish to %s the item %s document: %s',
  'NOOP': ' - > operation %s on the item %s document: %s is not defined'
};

var Service = function(params) {
  var self = this;
  var config = lodash.pick(params || {}, ['elasticsearch', 'redis', 'mongodb', 'runhook']);
  //self.config = lodash.assign({}, params || {});
  
  var elasticsearchHelper = new ElasticsearchHelper(params);
  var mongodbHelper = new MongodbHelper(params);
  
  var runhookManager = new RunhookManager(lodash.defaultsDeep(config, {
    runhook: {
      context: {
        elasticsearch_index_url: params.derivedConfig.es_index_url,
        mongo_collection_names: params.derivedConfig.mongo_collection_names
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
  
  jobQueue.process('oplog-handling-runner', function (job, done) {
    var entity = job.data.entity;
    var operation = job.data.operation;
    var doc = job.data.document;
    
    if (runhookManager.isRunhookAvailable(OPLOG_KEY, entity, operation)) {
      logger.trace(OPLOG_MSG.BEGIN, operation, entity, JSON.stringify(doc));
      runhookManager.callRunhook(OPLOG_KEY, entity, operation, doc).then(function(result) {
        logger.trace(OPLOG_MSG.RESULT, operation, entity, JSON.stringify(doc), JSON.stringify(result));
      }).catch(function(e) {
        logger.error(OPLOG_MSG.ERROR, operation, entity, JSON.stringify(doc), lodash.isString(e) ? e : JSON.stringify(e));
      }).finally(function() {
        logger.trace(OPLOG_MSG.END, operation, entity, JSON.stringify(doc));
        done && done();
      });
    } else {
      logger.trace(OPLOG_MSG.NOOP, operation, entity, JSON.stringify(doc));
      done && done();
    }
  });
  
  self.getJobQueue = function() {
    return jobQueue;
  };
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
