'use strict';

var events = require('events');
var util = require('util');

var Promise = require('bluebird');
var lodash = require('lodash');

var Injektor = require('injektor');

var LoggingFactory = require('../services/logging-factory.js');

var ElasticsearchHelper = require('../helpers/elasticsearch-helper.js');
var MongodbHelper = require('../helpers/mongodb-helper.js');

var ContextManager = require('../services/context-manager.js');
var ServiceManager = require('../services/service-manager.js');
var JobqueueAdapter = require('../services/jobqueue-adapter.js');
var JobqueueWorker = require('../services/jobqueue-worker.js');
var RunhookManager = require('../services/runhook-manager.js');
var MongodbTrigger = require('../triggers/mongodb-trigger.js');

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

    logger.trace(' + create sandbox[%s].injektor object', key);
    sandbox_key.injektor = new Injektor();
    sandbox_key.injektor
      .registerObject('contextname', key)
      .registerObject('configuration', context_key)
      .defineService('loggingFactory', LoggingFactory)
      .defineService('elasticsearchHelper', ElasticsearchHelper)
      .defineService('mongodbHelper', MongodbHelper)
      .defineService('contextManager', ContextManager)
      .defineService('serviceManager', ServiceManager)
      .defineService('jobqueueAdapter', JobqueueAdapter)
      .defineService('jobqueueWorker', JobqueueWorker)
      .defineService('runhookManager', RunhookManager)
      .defineService('mongodbTrigger', MongodbTrigger);

    var mongodbTrigger = sandbox_key.injektor.lookup('mongodbTrigger');
    mongodbTrigger.start();
    
    sandbox[key] = sandbox_key;
  });
  
  // lodash.forOwn(sandbox, function(value, key) {
  //   logger.trace(' + startup sandbox[%s].mongodbTrigger', key);
  //   sandbox[key].injektor.lookup('mongodbTrigger').start();
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
    return sandbox[currentContext].injektor.lookup(sandboxName);
  };
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
