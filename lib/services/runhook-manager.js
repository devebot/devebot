'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');

var fileutil = require('../utils/fileutil.js');
var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');
var loader = require('../utils/loader.js');

var Service = function(params) {
  var self = this;
  self.config = params;

  var runhooks = {};
  
  self.getRunhooks = function() {
    return runhooks;
  };
  
  var mergeRunhookEntries = function(runhookStore) {
    var runhookFiles = fileutil.listConfigFiles(runhookStore);
    
    logger.trace(' + runhookStore: %s', runhookStore);
    logger.trace(' + runhookFiles: %s', JSON.stringify(runhookFiles));
    
    runhookFiles.forEach(function(file) {
      mergeRunhookEntry(runhookStore, file);
    });
  };
  
  var mergeRunhookEntry = function(runhookStore, file) {
    var filepath = path.join(runhookStore, file);
    var target = loader(filepath)(self.config.runhook);
    var entryPath = file.replace('.js', '').toLowerCase().split('_').reverse();
    entryPath.unshift(target);
    var entry = lodash.reduce(entryPath, function(result, item) {
      var nestEntry = {};
      nestEntry[item] = result;
      return nestEntry;
    });
    lodash.defaultsDeep(self.getRunhooks(), entry);
  };
  
  mergeRunhookEntries(self.config[constx.RUNHOOK.ROOT_KEY]['folder']);
};

util.inherits(Service, events.EventEmitter);

Service.prototype.getRunhookEntities = function(routine) {
  var self = this;
  var runhookRoot = self.getRunhooks()[constx.RUNHOOK.ROOT_KEY] || {};
  
  var modelsByRoutine = [];
  var models = lodash.keys(runhookRoot) || [];
  for(var i=0; i<models.length; i++) {
    if (lodash.isObject(runhookRoot[models[i]]) && 
        lodash.isObject(runhookRoot[models[i]][routine])) {
      modelsByRoutine.push(models[i]);
    }
  }
  
  return modelsByRoutine;
};

Service.prototype.getRunhookOperations = function(routine, entity) {
  var self = this;
  var runhookRoot = self.getRunhooks()[constx.RUNHOOK.ROOT_KEY];
  if (lodash.isObject(runhookRoot) && 
        lodash.isObject(runhookRoot[entity]) &&
        lodash.isObject(runhookRoot[entity][routine])) {
  	return lodash.keys(runhookRoot[entity][routine]);
  }
  return [];
};

Service.prototype.isRunhookAvailable = function(routine, entity, operation) {
  var self = this;
  var runhookRoot = self.getRunhooks()[constx.RUNHOOK.ROOT_KEY];
  return (lodash.isObject(runhookRoot) && 
        lodash.isObject(runhookRoot[entity]) &&
        lodash.isObject(runhookRoot[entity][routine]) &&
        lodash.isFunction(runhookRoot[entity][routine][operation]));
};

Service.prototype.callRunhook = function(routine, entity, operation, document) {
  var self = this;
  var runhookRoot = self.getRunhooks()[constx.RUNHOOK.ROOT_KEY];
  if (self.isRunhookAvailable(routine, entity, operation)) {
    return Promise.resolve(runhookRoot[entity][routine][operation].call(self, document));
  } else {
    return Promise.reject({ name: 'runhook_is_not_available', routine: routine, 
    	entity: entity, operation: operation});
  }
};

module.exports = Service;
