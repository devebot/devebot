'use strict';

var events = require('events');
var util = require('util');
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
  
  var sandboxes = {};
  
  var contexts = params.server.context || {};
  lodash.forOwn(contexts, function(value, key) {
    var sandbox = {};

    logger.debug(' + load the context[%s] with configuration %s', key, JSON.stringify(value));

    logger.trace(' + create sandbox[%s].injektor object', key);
    sandbox.injektor = new Injektor();
    sandbox.injektor
      .registerObject('sandboxname', key)
      .registerObject('configuration', value)
      .defineService('loggingFactory', LoggingFactory)
      .defineService('elasticsearchHelper', ElasticsearchHelper)
      .defineService('mongodbHelper', MongodbHelper)
      .defineService('contextManager', ContextManager)
      .defineService('serviceManager', ServiceManager)
      .defineService('jobqueueAdapter', JobqueueAdapter)
      .defineService('jobqueueWorker', JobqueueWorker)
      .defineService('runhookManager', RunhookManager)
      .defineService('mongodbTrigger', MongodbTrigger);

    var mongodbTrigger = sandbox.injektor.lookup('mongodbTrigger');
    mongodbTrigger.start();
    
    sandboxes[key] = sandbox;
  });
  
  // lodash.forOwn(sandboxes, function(value, key) {
  //   logger.trace(' + startup sandbox[%s].mongodbTrigger', key);
  //   sandboxes[key].injektor.lookup('mongodbTrigger').start();
  // });

  self.getSandboxNames = function() {
    return lodash.keys(sandboxes);
  };
  
  self.isSandboxAvailable = function(sandboxName) {
    return lodash.isObject(sandboxes[sandboxName]);
  };
  
  var sandboxPointer = lodash.keys(sandboxes)[0];
  
  self.getSandboxPointer = function() {
    return sandboxPointer;
  };
  
  self.setSandboxPointer = function(sandboxName) {
    sandboxPointer = sandboxName;
  };
  
  self.getSandboxService = function(serviceName) {
    return sandboxes[sandboxPointer].injektor.lookup(serviceName);
  };
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
