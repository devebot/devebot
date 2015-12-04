'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var lodash = require('lodash');

var fileutil = require('../utils/fileutil.js');
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
  var self = this;
  
  params = params || {};
  self.runhookInstance = params;
  
  var config = params.configuration;

  logger.trace(' * create a runhook-manager instance in context <%s>', params.contextname);

  var runhookRoot = {};
  
  self.getRunhooks = function() {
    return (runhookRoot[constx.RUNHOOK.ROOT_KEY] || {});
  };
  
  var mergeRunhookEntries = function(runhookStore) {
    logger.trace(' + runhookStore: %s', runhookStore);
    var runhookFiles = fileutil.listConfigFiles(runhookStore);
    runhookFiles.forEach(function(file) {
      mergeRunhookEntry(runhookStore, file);
    });
  };
  
  var mergeRunhookEntry = function(runhookStore, file) {
    var filepath = path.join(runhookStore, file);
    var target = loader(filepath)(self.runhookInstance);
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
  
  self.isRunhookPathAsc = function() {
    return true;
  };
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
  if (self.isRunhookAvailable(routine, entity, operation)) {
    if (self.isRunhookPathAsc()) {
      return Promise.resolve(runhooks[routine][entity][operation].call(self.runhookInstance, document));
    } else {
      return Promise.resolve(runhooks[entity][routine][operation].call(self.runhookInstance, document));
    }
  } else {
    return Promise.reject({ name: 'runhook_is_not_available', routine: routine, 
    	entity: entity, operation: operation});
  }
};

module.exports = Service;
