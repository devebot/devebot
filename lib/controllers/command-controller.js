'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var SandboxManager = require('../services/sandbox-manager.js');

var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');

function init(params) {
  
  var sandboxManager = new SandboxManager(params);
  
  var controller = {};
  
  controller.getDefinition = function(req, res) {
    var clidef = {
      appinfo: params.APPINFO,
      commands: [
        {
          name: constx.CMDSET.SANDBOX_INFO,
          description: 'Display the sandbox information (how many sandboxes, current sandbox name)',
          options: []
        },
        {
          name: constx.CMDSET.SANDBOX_USE,
          description: 'Set the current sandbox to interaction',
          options: [
            {
              abbr: 'n',
              name: 'name',
              description: 'Name of the new current sandbox',
              required: true
            }
          ]
        },
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
          name: constx.CMDSET.ES_INFO,
          description: 'Display the elasticsearch information (settings, mappings)',
          options: []
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
          description: 'Indexing all documents of an entity from MongoDB to Elasticsearch',
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
    
    var elasticsearchHelper = sandboxManager.getSandbox('elasticsearchHelper');
    var mongodbHelper = sandboxManager.getSandbox('mongodbHelper');
    var jobqueueAdapter = sandboxManager.getSandbox('jobqueueAdapter');
    
    switch(cmd.command) {
      case constx.CMDSET.SANDBOX_INFO:
        promixe = Promise.resolve({ 
          currentContext: sandboxManager.getCurrentContext(),
          elasticsearchHelper: elasticsearchHelper,
          mongodbHelper: mongodbHelper,
          jobqueueAdapter: jobqueueAdapter
        });
        finishSimpleCommand(promixe, socket);
        break;

      case constx.CMDSET.SANDBOX_USE:
        var sandboxName = cmd.options['name'];
        if (sandboxManager.isValidContext(sandboxName)) {
          sandboxManager.setCurrentContext(sandboxName);
          promixe = Promise.resolve({ currentContext: sandboxName });
        } else {
          promixe = Promise.reject('context_name_is_invalid');
        }
        
        finishSimpleCommand(promixe, socket);
        break;

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

      case constx.CMDSET.ES_INFO:
        promixe = Promise.all([
          elasticsearchHelper.getIndexSettings(),
          elasticsearchHelper.getIndexMappings()
        ]);
        finishSimpleCommand(promixe, socket);
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
        message: constx.WEBSOCKET.MSG_ON.SUCCESS,
        value: value
      }));
    }, function(error) {
      socket.send(JSON.stringify({ 
        state: constx.WEBSOCKET.STATE.FAILURE,
        message: constx.WEBSOCKET.MSG_ON.FAILURE,
        error: error
      }));
    }).finally(function() {
      socket.send(JSON.stringify({ state: constx.WEBSOCKET.STATE.DONE }));
    });
  };

  return controller;
}

module.exports = init;