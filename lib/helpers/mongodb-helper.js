'use strict';

var events = require('events');
var util = require('util');
var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');
var mongojs = require('mongojs');
var ObjectId = mongojs.ObjectId;

var Service = function(params) {
  params = params || {};
  
  var self = this;
  
  var loggingFactory = params.loggingFactory;
  self.logger = loggingFactory.getLogger();
  
  var config = lodash.pick(params.sandboxconfig || {}, ['mongodb']);
  var mongo_conf = config['mongodb'] || {};
  var mongo_connection_string = util.format('mongodb://%s:%s/%s', 
      mongo_conf.host, mongo_conf.port, mongo_conf.name);

  self.mongo_cols = mongo_conf.cols;
  self.mongodb = mongojs(mongo_connection_string, lodash.values(self.mongo_cols));
  
  self.getSandboxName = function() {
    return params.sandboxname;
  };
};

Service.argumentSchema = {
  "id": "/mongodbHelper",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "sandboxconfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

Service.prototype.stats = function() {
  var self = this;
  return Promise.promisify(function(callback) {
    self.mongodb.stats(callback);
  })();
};

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
        self.logger.info('<%s> - findOneDocument("%s", "%s") has error: %s', self.getSandboxName(),
            entity, JSON.stringify(criteria), JSON.stringify(err));
      } else {
        self.logger.info('<%s> - findOneDocument("%s", "%s") result: %s', self.getSandboxName(),
            entity, JSON.stringify(criteria), JSON.stringify(obj));
      }
      callback(err, obj);
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
        self.logger.info('<%s> - getDocumentById("%s", "%s") has error: %s', self.getSandboxName(), 
            entity, id, JSON.stringify(err));
      } else {
        self.logger.info('<%s> - getDocumentById("%s", "%s") result: %s', self.getSandboxName(),
            entity, id, JSON.stringify(obj));
      }
      callback(err, obj);
    });
  })();
};

Service.prototype.getDocumentsByIds = function(entityName, documentIds) {
  var self = this;
  self.logger.info('<%s> + getDocumentsByIds("%s", "%s")', self.getSandboxName(), 
      entityName, JSON.stringify(documentIds));
  
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
        self.logger.info('<%s> - getDocumentsByIds("%s", "%s") has error: %s', self.getSandboxName(), 
            entityName, JSON.stringify(documentIds), JSON.stringify(err));
      } else {
        self.logger.info('<%s> - getDocumentsByIds("%s", "%s") result: %s', self.getSandboxName(), 
            entityName, JSON.stringify(documentIds), JSON.stringify(objs));
      }
      callback(err, objs);
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
        if (lodash.isObject(document)) {
          documents.push(document);
          documentId = document.parentId;
        } else {
          documentId = null;
        }
        done_doWhilst();
      });
    }, function(error_doWhilst) {
      callback(error_doWhilst, documents);
    });
  })();
};

Service.prototype.getChainToTopOfHierarchicalDocumentsByIds = function(entityName, documentIds) {
  var self = this;
  var documents = [];
  var scanDocuments = function(callback) {
    async.eachSeries(documentIds, function(documentId, done_each) {
      self.getHierarchicalDocumentsToTop(entityName, documentId).then(function(chain) {
        if (lodash.isArray(chain) && chain.length > 0) {
          documents.push({
            documentId: documentId,
            documentObject: chain[0],
            documentChain: chain
          });
        }
        done_each();
      });
    }, function(error_each) {
      callback(error_each, documents);
    });
  };
  return Promise.promisify(scanDocuments)();
};

Service.prototype.insertDocument = function(entity, documents) {
  var self = this;
  return Promise.promisify(function (done) {
    self.mongodb[entity].insert(documents, function(err, result) {
  		if (err) {
  		  self.logger.info('<%s> - insert documents %s of %s error: %s', self.getSandboxName(),
  		      JSON.stringify(documents), entity, err);
  		} else {
  		  self.logger.info('<%s> - insert documents %s of %s successful: ', self.getSandboxName(),
  		      JSON.stringify(documents), entity, JSON.stringify(result));
  		}
  		done(err, result);
	  });
  })();
};

Service.prototype.updateDocument = function(entity, criteria, data, options) {
  var self = this;
  options = options || {multi: true, upsert: false};
  var promisee = function (done) {
    self.mongodb[entity].update(criteria, {$set: data}, options, function(err, info) {
      if (err) {
        self.logger.info('<%s> - update %s document: %s with options %s and criteria %s has error: %s', self.getSandboxName(),
            entity, JSON.stringify(data), JSON.stringify(options), JSON.stringify(criteria), err);
      } else {
        self.logger.info('<%s> - update %s document: %s with options %s and criteria %s successul: %s', self.getSandboxName(),
            entity, JSON.stringify(data), JSON.stringify(options), JSON.stringify(criteria), JSON.stringify(info));
      }
      done(err, info);
    });
  };
  return Promise.promisify(promisee)();
};

Service.prototype.deleteDocument = function(entityName, criteria) {
  var self = this;
  var promisee = function (done) {
    self.mongodb[entityName].remove(criteria, function(err, result) {
  		if (err) {
  		  self.logger.info('<%s> - delete %s document with criteria %s has error: %s', self.getSandboxName(),
  		      entityName, JSON.stringify(criteria), err);
  		} else {
  		  self.logger.info('<%s> - delete %s document with criteria %s result: %s', self.getSandboxName(),
  		      entityName, JSON.stringify(criteria), JSON.stringify(result));
  		}
  		done(err, result);
	  });
  }; 
  return Promise.promisify(promisee)();
};

module.exports = Service;
