'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');

var fileutil = require('../utils/fileutil.js');
var logger = require('../utils/logger.js');
var loader = require('../utils/loader.js');

var templateRunhook = {
  oplog: ['insert', 'update', 'delete']
};

var ROOT_KEY = 'runhook';

var Service = function(params) {
  var self = this;
  self.config = params;

  var runhooks = {};
  
  self.getRunhooks = function() {
    return runhooks;
  };
  
  var runhookStore = self.config[ROOT_KEY]['folder'];
  logger.trace(' + runhookStore: %s', runhookStore);

  var runhookFiles = fileutil.listConfigFiles(runhookStore);
  logger.trace(' + runhookFiles: %s', JSON.stringify(runhookFiles));

  var mergeRunhookEntries = function(runhookFiles) {
    runhookFiles.forEach(function(file) {
      mergeRunhookEntry(file);
    });
  };
  
  var mergeRunhookEntry = function(file) {
    var runhookStore = self.config[ROOT_KEY]['folder'];
  
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
  
  mergeRunhookEntries(runhookFiles);
};

util.inherits(Service, events.EventEmitter);

Service.prototype.getRunhookEntities = function(type) {
  var self = this;
  var runhookRoot = self.getRunhooks()[ROOT_KEY] || {};
  
  var modelsByType = [];
  var models = lodash.keys(runhookRoot) || [];
  for(var i=0; i<models.length; i++) {
    if (lodash.isObject(runhookRoot[models[i]]) && 
        lodash.isObject(runhookRoot[models[i]][type])) {
      modelsByType.push(models[i]);
    }
  }
  
  return modelsByType;
};

Service.prototype.getRunhookOperations = function(type, entity) {
  var self = this;
  var runhookRoot = self.getRunhooks()[ROOT_KEY];
  if (lodash.isObject(runhookRoot) && 
        lodash.isObject(runhookRoot[entity]) &&
        lodash.isObject(runhookRoot[entity][type])) {
  	return lodash.keys(runhookRoot[entity][type]);
  }
  return [];
};

Service.prototype.isRunhookAvailable = function(type, entity, operation) {
  var self = this;
  var runhookRoot = self.getRunhooks()[ROOT_KEY];
  return (lodash.isObject(runhookRoot) && 
        lodash.isObject(runhookRoot[entity]) &&
        lodash.isObject(runhookRoot[entity][type]) &&
        lodash.isFunction(runhookRoot[entity][type][operation]));
};

Service.prototype.callRunhook = function(type, entity, operation, document) {
  var self = this;
  var runhookRoot = self.getRunhooks()[ROOT_KEY];
  if (self.isRunhookAvailable(type, entity, operation)) {
    return Promise.resolve(runhookRoot[entity][type][operation].call(self, document));
  } else {
    return Promise.reject({ name: 'runhook_is_not_available', type: type, 
    	entity: entity, operation: operation});
  }
};

module.exports = Service;
