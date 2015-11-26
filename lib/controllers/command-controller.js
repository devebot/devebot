'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var ElasticsearchHelper = require('../helpers/elasticsearch-helper.js');
var MongodbHelper = require('../helpers/mongodb-helper.js');

var ContextManager = require('../services/context-manager.js');
var ServiceManager = require('../services/service-manager.js');
var JobqueueAdapter = require('../services/jobqueue-adapter.js');
var MongodbTrigger = require('../triggers/mongodb-trigger.js');

var constx = require('../utils/constx.js');

function init(params) {
  
  var elasticsearchHelper = new ElasticsearchHelper({
    configuration: params.SERVER
  });

  var mongodbHelper = new MongodbHelper({
    configuration: params.SERVER
  });
  
  var contextManager = new ContextManager({
    configuration: params.SERVER
  });
  
  var serviceManager = new ServiceManager({
    configuration: params.SERVER
  });
  
  var jobqueueAdapter = new JobqueueAdapter({
    configuration: params.SERVER,
    contextManager: contextManager,
    serviceManager: serviceManager
  });
  
  var mongodbTrigger = new MongodbTrigger({
    configuration: params.SERVER,
    jobqueueAdapter: jobqueueAdapter
  });
  mongodbTrigger.start();
  
  var controller = {};
  
  controller.getDefinition = function(req, res) {
    var clidef = {
      appinfo: params.APPINFO,
      commands: [
        {
          name: constx.CMDSET.SYSTEM_INFO,
          description: 'Display the system information (configuration, mongodb, elasticsearch, ...)',
          options: []
        },
        {
          name: constx.CMDSET.RANDOM_DATA,
          description: 'Random data for the Application',
          options: [
            {
              abbr: 'm',
              name: 'mode',
              description: 'append|override - default is override',
              required: false
            }
          ]
        },
        {
          name: constx.CMDSET.ES_CLEAR,
          description: 'Destroy all of current elasticsearch data/structure',
          options: []
        },
        {
          name: constx.CMDSET.ES_RESET,
          description: 'Destroy all of old data/structure and initialize the new structure',
          options: []
        },
        {
          name: constx.CMDSET.ES_INDEX_ALL,
          description: 'Indexing all of data from MongoDB to Elasticsearch',
          options: []
        },
        {
          name: constx.CMDSET.ES_INDEX_ENTITY,
          description: 'Indexing all of data from MongoDB to Elasticsearch',
          options: [
            {
              abbr: 'e',
              name: 'entity',
              description: 'The name of entity should be indexed',
              required: true
            }
          ]
        },
        {
          name: constx.CMDSET.ES_INDEX_ONE,
          description: 'Indexing data of one document from MongoDB to Elasticsearch',
          options: [
            {
              abbr: 'e',
              name: 'entity',
              description: 'The name of entity should be indexed',
              required: true
            },
            {
              abbr: 'i',
              name: 'idcode',
              description: 'The id/code of document that should be indexed',
              required: true
            }
          ]
        },
      ]
    };
    res.status(200).send(clidef);
  };
  
  controller.postCommand = function(req, res) {
    var cmd = req.body || {};
    if (lodash.isString(cmd)) {
      cmd = JSON.parse(cmd);
    }
    switch(cmd.command) {
      case 'noop':
        break;
    }
    res.status(200).send({echo: cmd});
  };
  
  controller.executeCommand = function(command, socket) {
    var listeners = { ws: socket };
    var cmd = command || {};
    if (lodash.isString(cmd)) {
      cmd = JSON.parse(cmd);
    }
    var promixe;
    
    switch(cmd.command) {
      case constx.CMDSET.SYSTEM_INFO:
        promixe = Promise.all([
          mongodbHelper.stats(),
          elasticsearchHelper.getClusterStats()
        ]);
        finishSimpleCommand(promixe, socket);
        break;

      case constx.CMDSET.RANDOM_DATA:
        jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.MOCKIT, 
            '#global#', 'randomize', {}, listeners).finally(function() {
          socket.send(JSON.stringify({ state: 'done' }));
        });
        break;

      case constx.CMDSET.ES_CLEAR:
        promixe = elasticsearchHelper.dropIndex();
        finishSimpleCommand(promixe, socket);
        break;

      case constx.CMDSET.ES_RESET:
        promixe = elasticsearchHelper.resetIndex();
        finishSimpleCommand(promixe, socket);
        break;

      case constx.CMDSET.ES_INDEX_ALL:
        var entityNames = jobqueueAdapter.getRunhookEntities(constx.RUNHOOK.KEY.MARKUP);
        lodash.remove(entityNames, function(item) {
          return item == constx.RUNHOOK.ENTITY.GLOBAL;
        });
        promixe = Promise.map(entityNames, function(entityName) {
          return jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.MARKUP, 
              entityName, 'all', {}, listeners);
        });
        finishSimpleCommand(promixe, socket);
        break;

      case constx.CMDSET.ES_INDEX_ENTITY:
        var entityName = cmd.options['entity'];
        promixe = jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.MARKUP, 
              entityName, 'all', {}, listeners);
        finishSimpleCommand(promixe, socket);
        break;

      case constx.CMDSET.ES_INDEX_ONE:
        var entityName = cmd.options['entity'];
        var idOrCode = cmd.options['idcode'];
        promixe = jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.MARKUP, 
              entityName, 'one', idOrCode, listeners);
        finishSimpleCommand(promixe, socket);
        break;

      default:
        socket.send(JSON.stringify({ state: 'noop' }));
    }
  };

  var finishSimpleCommand = function(promise, socket) {
    promise.then(function(value) {
      socket.send(JSON.stringify({ 
        state: constx.WEBSOCKET.STATE.SUCCESS,
        value: value,
        result: constx.WEBSOCKET.MSG_ON.SUCCESS,
        message: constx.WEBSOCKET.MSG_ON.SUCCESS
      }));
    }, function(error) {
      socket.send(JSON.stringify({ 
        state: constx.WEBSOCKET.STATE.FAILURE,
        error: error,
        message: constx.WEBSOCKET.MSG_ON.FAILURE
      }));
    }).finally(function() {
      socket.send(JSON.stringify({ state: constx.WEBSOCKET.STATE.DONE }));
    });
  };

  return controller;
}

module.exports = init;