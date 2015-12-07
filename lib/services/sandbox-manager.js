'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');
var lodash = require('lodash');

var ElasticsearchHelper = require('../helpers/elasticsearch-helper.js');
var MongodbHelper = require('../helpers/mongodb-helper.js');

var ContextManager = require('../services/context-manager.js');
var ServiceManager = require('../services/service-manager.js');
var JobqueueAdapter = require('../services/jobqueue-adapter.js');
var MongodbTrigger = require('../triggers/mongodb-trigger.js');
var LoggingFactory = require('../services/logging-factory.js');

var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  params = params || {};
  
  var self = this;
  var sandbox = {};
  
  var contexts = params.server.context || {};
  lodash.forOwn(contexts, function(value, key) {
    var context_key = value;
    var sandbox_key = {};

    logger.debug(' + load the context[%s] with value %s', key, JSON.stringify(context_key));

    logger.trace(' + create sandbox[%s].loggingFactory.', key);
    sandbox_key.loggingFactory = new LoggingFactory({
      contextname: key,
      configuration: context_key
    });

    logger.trace(' + create sandbox[%s].elasticsearchHelper.', key);
    sandbox_key.elasticsearchHelper = new ElasticsearchHelper({
      contextname: key,
      configuration: context_key
    });

    logger.trace(' + create sandbox[%s].mongodbHelper.', key);
    sandbox_key.mongodbHelper = new MongodbHelper({
      contextname: key,
      configuration: context_key
    });

    logger.trace(' + create sandbox[%s].contextManager.', key);
    sandbox_key.contextManager = new ContextManager({
      contextname: key,
      configuration: context_key
    });

    logger.trace(' + create sandbox[%s].serviceManager.', key);
    sandbox_key.serviceManager = new ServiceManager({
      contextname: key,
      configuration: context_key
    });
     
    logger.trace(' + create sandbox[%s].jobqueueAdapter.', key);
    sandbox_key.jobqueueAdapter = new JobqueueAdapter({
      contextname: key,
      configuration: context_key,
      context: {
        elasticsearch_index_url: context_key.derivedConfig.es_index_url,
        mongo_collection_names: context_key.derivedConfig.mongo_collection_names
      },
      service: {
        elasticsearchHelper: sandbox_key.elasticsearchHelper,
        mongodbHelper: sandbox_key.mongodbHelper
      }
    });
    
    logger.trace(' + create sandbox[%s].mongodbTrigger.', key);
    sandbox_key.mongodbTrigger = new MongodbTrigger({
      contextname: key,
      configuration: context_key,
      jobqueueAdapter: sandbox_key.jobqueueAdapter
    });

    logger.trace(' + startup sandbox[%s].mongodbTrigger.', key);
    sandbox_key.mongodbTrigger.start();

    sandbox[key] = sandbox_key;
  });
  
  // lodash.forOwn(sandbox, function(value, key) {
  //   logger.trace(' + startup sandbox[%s].mongodbTrigger.', key);
  //   sandbox[key].mongodbTrigger.start();
  // });

  this.getAvailableContexts = function() {
    return lodash.keys(sandbox);
  };
  
  this.isValidContext = function(contextName) {
    return lodash.isObject(sandbox[contextName]);
  };
  
  var currentContext = lodash.keys(sandbox)[0];
  
  this.getCurrentContext = function() {
    return currentContext;
  };
  
  this.setCurrentContext = function(newContext) {
    currentContext = newContext;
  };
  
  this.getSandbox = function(sandboxName) {
    return sandbox[currentContext][sandboxName];
  };
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
