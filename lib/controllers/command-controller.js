'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var Validator = require('jsonschema').Validator;
var validator = new Validator();

var SandboxManager = require('../services/sandbox-manager.js');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

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
          name: constx.CMDSET.DATABASE_IMPORT_ALL,
          description: 'Import all of data from CSV files to Database',
          options: []
        },
        {
          name: constx.CMDSET.DATABASE_IMPORT_ENTITY,
          description: 'Import all of data of a collection/table from CSV to Database',
          options: [
            {
              abbr: 'e',
              name: 'entity',
              description: 'The name of collection/table should be imported',
              required: true
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
        {
          name: constx.CMDSET.LOG_CHANGE_LEVEL,
          description: 'Changes logging level for one or more transports',
          options: [
            {
              abbr: 'l',
              name: 'level',
              description: 'The new level label applied for transports',
              required: true
            },
            {
              abbr: 't',
              name: 'transports',
              description: 'The list of transports will be applied new level',
              required: false
            }
          ]
        },
        {
          name: constx.CMDSET.LOG_RESET_LEVELS,
          description: 'Resets logging level to the default levels',
          options: []
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
    
    var loggingFactory = sandboxManager.getSandboxService('loggingFactory');
    var elasticsearchHelper = sandboxManager.getSandboxService('elasticsearchHelper');
    var mongodbHelper = sandboxManager.getSandboxService('mongodbHelper');
    var jobqueueAdapter = sandboxManager.getSandboxService('jobqueueAdapter');
    var mongodbTrigger = sandboxManager.getSandboxService('mongodbTrigger');
    
    switch(cmd.command) {
      case constx.CMDSET.SANDBOX_INFO:
        var buildCommandOutput = function() {
          var logging_factory_info = loggingFactory.getServiceInfo();
          var elasticsearch_helper_info = elasticsearchHelper.getServiceInfo();
          var mongodb_helper_info = mongodbHelper.getServiceInfo();
          var mongodb_trigger_info = mongodbTrigger.getServiceInfo();
          var blocks = [];
          blocks.push({
            type: 'record',
            title: 'Connection information',
            label: {
              sandbox_pointer: 'Current sanbox',
              es_index_name: 'ES Index name',
              es_index_url: 'ES Index URL',
              mongodb_url: 'Mongo URL',
              mongodb_cols: 'Mongo collections',
              mongodb_trigger_url: 'Oplog Source',
            },
            data: {
              sandbox_pointer: sandboxManager.getSandboxPointer(),
              es_index_url: elasticsearch_helper_info.url,
              es_index_name: elasticsearch_helper_info.connection_info.name,
              mongodb_url: mongodb_helper_info.url,
              mongodb_cols: JSON.stringify(mongodb_helper_info.collection_defs, null, 2),
              mongodb_trigger_url: mongodb_trigger_info.url
            }
          });
          return Promise.resolve(blocks);
        };
        sendCommandOutput(socket, buildCommandOutput(), true);
        break;

      case constx.CMDSET.SANDBOX_USE:
        var sandboxName = cmd.options['name'];
        if (sandboxManager.isSandboxAvailable(sandboxName)) {
          sandboxManager.setSandboxPointer(sandboxName);
          promixe = Promise.resolve({ currentSandbox: sandboxName });
        } else {
          promixe = Promise.reject({ error: 'context_name_is_invalid' });
        }
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.SYSTEM_INFO:
        promixe = Promise.all([
          mongodbHelper.stats(),
          elasticsearchHelper.getClusterStats()
        ]);
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.RANDOM_DATA:
        jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.MOCKIT, 
            '#global#', 'randomize', {}, listeners).finally(function() {
          socket.send(JSON.stringify({ state: 'done' }));
        });
        break;

      case constx.CMDSET.DATABASE_IMPORT_ALL:
        var entityNames = jobqueueAdapter.getRunhookEntities(constx.RUNHOOK.KEY.IMPORT);
        lodash.remove(entityNames, function(item) {
          return item == constx.RUNHOOK.ENTITY.GLOBAL;
        });
        promixe = Promise.map(entityNames, function(entityName) {
          return jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.IMPORT, 
              entityName, 'merge', {}, listeners);
        });
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.DATABASE_IMPORT_ENTITY:
        var entityName = cmd.options['entity'];
        promixe = jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.IMPORT, 
              entityName, 'merge', {}, listeners);
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.ES_INFO:
        var buildCommandOutput = function() {
          var es_service_info = elasticsearchHelper.getServiceInfo();
          var blocks = [];
          return Promise.resolve().then(function() {
            blocks.push({
              type: 'record',
              title: 'Elasticsearch connection information',
              label: {
                sandbox_name: 'Current sanbox',
                index_url: 'Index URL'
              },
              data: {
                sandbox_name: elasticsearchHelper.getSandboxName(),
                index_url: elasticsearchHelper.es_index_url
              }
            });
            return Promise.all([
              elasticsearchHelper.getIndexSettings(),
              elasticsearchHelper.getIndexMappings()
            ]);
          }).then(function(info) {
            info = info || [];
            if (info[0]) {
              blocks.push({
                type: 'json',
                title: 'Elasticsearch Index settings',
                data: info[0]
              });
            }
            if (info[1]) {
              blocks.push({
                type: 'json',
                title: 'Elasticsearch Index mappings',
                data: info[1]
              });
            }
            return (info.length >= 2) ? info[1] : {};
          }).then(function(mappings) {
            var es_index_name = es_service_info.connection_info.name;
            var es_types = lodash.get(mappings, [es_index_name, 'mappings'], {});
            var es_type_names = lodash.keys(es_types);
            return Promise.mapSeries(es_type_names, function(es_type_name) {
              return elasticsearchHelper.countDocuments(es_type_name);
            }).then(function(counts) {
              counts = counts || [];
              var countLabels = {};
              var countResult = {};
              for(var i=0; i<counts.length; i++) {
                countLabels[es_type_names[i]] = es_type_names[i];
                countResult[es_type_names[i]] = counts[i].count;
              }
              blocks.push({
                type: 'record',
                title: 'Elasticsearch document summary',
                label: countLabels,
                data: countResult
              });
              return Promise.resolve(blocks);
            });
          });
        };
        sendCommandOutput(socket, buildCommandOutput(), true);
        break;

      case constx.CMDSET.ES_CLEAR:
        promixe = elasticsearchHelper.dropIndex();
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.ES_RESET:
        promixe = elasticsearchHelper.resetIndex();
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.ES_INDEX_ALL:
        var entityNames = jobqueueAdapter.getRunhookEntities(constx.RUNHOOK.KEY.INDEX);
        lodash.remove(entityNames, function(item) {
          return item == constx.RUNHOOK.ENTITY.GLOBAL;
        });
        promixe = Promise.map(entityNames, function(entityName) {
          return jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.INDEX, 
              entityName, 'all', {}, listeners);
        });
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.ES_INDEX_ENTITY:
        var entityName = cmd.options['entity'];
        promixe = jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.INDEX, 
              entityName, 'all', {}, listeners);
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.ES_INDEX_ONE:
        var entityName = cmd.options['entity'];
        var idOrCode = cmd.options['idcode'];
        promixe = jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.INDEX, 
              entityName, 'one', idOrCode, listeners);
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.LOG_CHANGE_LEVEL:
        var level = cmd.options['level'];
        var transports = cmd.options['transports'];
        promixe = Promise.resolve().then(function() {
          var transportList = (lodash.isEmpty(transports) ? null : transports.split(','));
          loggingFactory.getLogger().setLevel(level, transportList);
          return {currentLogLevel: level};
        });
        sendCommandOutput(socket, promixe, true);
        break;

      case constx.CMDSET.LOG_RESET_LEVELS:
        promixe = Promise.resolve().then(function() {
          loggingFactory.getLogger().resetDefaultLevels();
          return {status: 'ok'};
        });
        sendCommandOutput(socket, promixe, true);
        break;

      default:
        socket.send(JSON.stringify({ state: 'noop' }));
    }
  };

  var sendCommandOutput = function(socket, promise, finished) {
    promise.then(function(value) {
      socket.send(JSON.stringify({
        state: constx.WEBSOCKET.STATE.SUCCESS,
        message: constx.WEBSOCKET.MSG_ON.SUCCESS,
        details: standardizeOutput(value, false)
      }));
    }, function(error) {
      socket.send(JSON.stringify({ 
        state: constx.WEBSOCKET.STATE.FAILURE,
        message: constx.WEBSOCKET.MSG_ON.FAILURE,
        details: standardizeOutput(error, true)
      }));
    }).finally(function() {
      if (finished) {
        socket.send(JSON.stringify({ state: constx.WEBSOCKET.STATE.DONE }));
      }
    });
  };

  var standardizeOutput = function(output, isError) {
    var title = isError ? constx.WEBSOCKET.MSG_ON.FAILURE : constx.WEBSOCKET.MSG_ON.SUCCESS;
    var valresult = validator.validate(output, constx.WEBSOCKET.DETAILS.SCHEMA);
    if (valresult.errors.length > 0) {
      return [{ type: 'json', title: title, data: output }];
    }
    return output;
  };

  return controller;
}

module.exports = init;