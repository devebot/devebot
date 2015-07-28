'use strict';

var events = require('events');
var path = require('path');
var util = require('util');
var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');
var mongojs = require('mongojs');
var ObjectId = mongojs.ObjectId;

var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  self.config = lodash.pick(params || {}, ['mongodb']);
  
  var mongo_conf = self.config['mongodb'] || {};
  var mongo_connection_string = util.format('mongodb://%s:%s/%s', 
      mongo_conf.host, mongo_conf.port, mongo_conf.name);
  self.mongo_cols = mongo_conf.cols;
  self.mongodb = mongojs(mongo_connection_string, lodash.values(self.mongo_cols));
};

util.inherits(Service, events.EventEmitter);

Service.prototype.getDocuments = function(entity, start, limit) {
  var self = this;
  return Promise.promisify(function(from, size, callback) {
    self.mongodb[entity].find({
    }).skip(from).limit(size).toArray(function(err, docs) {
      callback(err, docs);
    });
  })(start, limit);
};

Service.prototype.findOneDocument = function(entity, criteria) {
  var self = this;
  return Promise.promisify(function(callback) {
    self.mongodb[entity].findOne(criteria, function(err, obj) {
      if (err) {
        callback(err);
        return;
      }
      if (lodash.isNull(obj) || lodash.isNull(obj._id)) {
        callback({name: 'document_not_found', entity: entity, criteria: criteria});
        return;
      }
      callback(null, obj);
    });
  })();
};

Service.prototype.getDocumentById = function(entity, id) {
  var self = this;
  return Promise.promisify(function(callback) {
    if (lodash.isEmpty(id)) {
      callback({name: 'documentId_is_empty', entity: entity});
      return;
    }
    if (!(id instanceof ObjectId)) {
      id = ObjectId(id);
    }
    self.mongodb[entity].findOne({
      _id: id
    }, function(err, obj) {
      if (err) {
        callback(err);
        return;
      }
      if (lodash.isNull(obj) || lodash.isNull(obj._id)) {
        callback({name: 'document_not_found', entity: entity, id: id});
        return;
      }
      callback(null, obj);
    });
  })();
};

Service.prototype.getDocumentsByIds = function(entityName, documentIds) {
  var self = this;
  logger.trace(' + getDocumentsByIds() by Ids: %s', JSON.stringify(documentIds));
  
  return Promise.promisify(function(callback) {
    
    if (!lodash.isArray(documentIds)) {
      callback('documentIds_is_not_an_array');
      return;
    }

    documentIds = lodash.map(documentIds, function(documentId) {
      if (documentId instanceof ObjectId) {
        return documentId;
      } else {
        return ObjectId(documentId);
      }
    });

    self.mongodb[entityName].find({
      _id: {
        $in: documentIds
      }
    }, function(err, objs) {
      if (err) {
        callback(err);
        return;
      }
      
      logger.trace(' ->> getDocumentsByIds() result: %s', JSON.stringify(objs));
      callback(null, objs);
    });
  })();
};

Service.prototype.getOneToManyTargetsBySourceId = function(entityName, sourceIdName, sourceId) {
  var self = this;
  return Promise.promisify(function(callback) {
    if (!(sourceId instanceof ObjectId)) {
      sourceId = ObjectId(sourceId);
    }
    
    var criteria = {};
    criteria[sourceIdName] = sourceId;
    
    self.mongodb[entityName].find(criteria).toArray(function(err, docs) {
      callback(err, docs);
    });
  })();
};

Service.prototype.getHierarchicalDocumentsToTop = function(entity, documentId) {
  var self = this;
  var documents = [];
  return Promise.promisify(function(callback) {
    async.whilst(function() {
      return (!lodash.isEmpty(documentId));
    }, function(done_doWhilst) {
      self.getDocumentById(entity, documentId).then(function(document) {
        documents.push(document);
        documentId = document.parentId;
        done_doWhilst();
      });
    }, function(error_doWhilst) {
      callback(error_doWhilst, documents);
    });
  })();
};

module.exports = Service;
