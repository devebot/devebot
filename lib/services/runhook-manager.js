'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var lodash = require('lodash');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');
var loader = require('../utils/loader.js');

/**
 * The constructor for RunhookManager class.
 * 
 * @constructor
 * @param {Object} params - The parameters of the constructor.
 * @param {Object} params.runhook - The parameters that sent to Runhooks
 */
var Service = function(params) {
  params = params || {};
  
  var self = this;
  
  self.runhookInstance = {
    sandboxname: params.sandboxname,
    configuration: params.configuration,
    context: {
      elasticsearch_index_url: params.configuration.derivedConfig.es_index_url,
      mongo_collection_names: params.configuration.derivedConfig.mongo_collection_names
    },
    service: {
      elasticsearchHelper: params.elasticsearchHelper,
      mongodbHelper: params.mongodbHelper
    }
  };
  
  self.getSandboxName = function() {
    return params.sandboxname;
  };
  
  var config = params.configuration;

  logger.trace('<%s> + create a runhook-manager instance', self.getSandboxName());

  var runhookRoot = {};

  self.getRunhooks = function() {
    return (runhookRoot[constx.RUNHOOK.ROOT_KEY] || {});
  };

  self.isContextPassedAtLoading = function() {
    return config[constx.RUNHOOK.ROOT_KEY]['context_passed_at_loading'] == true;
  };

  self.isRunhookPathAsc = function() {
    return true;
  };

  var mergeRunhookEntries = function(runhookStore) {
    logger.trace('<%s> - runhookStore: %s', self.getSandboxName(), runhookStore);
    var runhookFiles = chores.listFiles(runhookStore);
    runhookFiles.forEach(function(file) {
      mergeRunhookEntry(runhookStore, file);
    });
  };
  
  var mergeRunhookEntry = function(runhookStore, file) {
    var filepath = path.join(runhookStore, file);
    var runhook_arguments = self.isContextPassedAtLoading() ? self.runhookInstance : {};
    var target = loader(filepath)(runhook_arguments);
    var entryPath = file.replace('.js', '').toLowerCase().split('_').reverse();
    entryPath.unshift(target);
    var entry = lodash.reduce(entryPath, function(result, item) {
      var nestEntry = {};
      nestEntry[item] = result;
      return nestEntry;
    });
    lodash.defaultsDeep(runhookRoot, entry);
  };
  
  mergeRunhookEntries(config[constx.RUNHOOK.ROOT_KEY]['folder']);
};

Service.argumentSchema = {
  "id": "/runhookManager",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "configuration": {
      "type": "object"
    },
    "elasticsearchHelper": {
      "type": "object"
    },
    "mongodbHelper": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

Service.prototype.getRunhookEntities = function(routine) {
  var self = this;
  var runhooks = self.getRunhooks();
  
  var modelsByRoutine = [];
  if (self.isRunhookPathAsc()) {
    if (lodash.isObject(runhooks[routine])) {
      modelsByRoutine = lodash.keys(runhooks[routine]);
    }
  } else {
    var models = lodash.keys(runhooks) || [];
    for(var i=0; i<models.length; i++) {
      if (lodash.isObject(runhooks[models[i]]) && 
          lodash.isObject(runhooks[models[i]][routine])) {
        modelsByRoutine.push(models[i]);
      }
    }
  }
  return modelsByRoutine;
};

Service.prototype.getRunhookOperations = function(routine, entity) {
  var self = this;
  var runhooks = self.getRunhooks();
  if (self.isRunhookPathAsc()) {
    if (lodash.isObject(runhooks[routine]) &&
        lodash.isObject(runhooks[routine][entity])) {
      return lodash.keys(runhooks[routine][entity]);
    }
  } else {
    if (lodash.isObject(runhooks[entity]) &&
        lodash.isObject(runhooks[entity][routine])) {
  	  return lodash.keys(runhooks[entity][routine]);
    }  
  }
  return [];
};

Service.prototype.isRunhookAvailable = function(routine, entity, operation) {
  var self = this;
  var runhooks = self.getRunhooks();
  if (self.isRunhookPathAsc()) {
    return (lodash.isObject(runhooks[routine]) &&
        lodash.isObject(runhooks[routine][entity]) &&
        lodash.isFunction(runhooks[routine][entity][operation]));
  } else {
    return (lodash.isObject(runhooks[entity]) &&
        lodash.isObject(runhooks[entity][routine]) &&
        lodash.isFunction(runhooks[entity][routine][operation]));
  }
};

Service.prototype.callRunhook = function(routine, entity, operation, document) {
  var self = this;
  var runhooks = self.getRunhooks();
  logger.trace('<%s> * callRunhook("%s", "%s", "%s")', self.getSandboxName(), routine, entity, operation);
  if (self.isRunhookAvailable(routine, entity, operation)) {
    var runhookOp = self.isRunhookPathAsc() ? runhooks[routine][entity][operation] : runhooks[entity][routine][operation];
    return Promise.resolve(self.isContextPassedAtLoading() ? runhookOp(document) : runhookOp.call(self.runhookInstance, document));
  } else {
    return Promise.reject({ name: 'runhook_is_not_available', routine: routine, entity: entity, operation: operation});
  }
};

module.exports = Service;
