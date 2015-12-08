'use strict';

var events = require('events');
var util = require('util');
var Promise = require('bluebird');
var lodash = require('lodash');
var superagent = require('superagent');

var constx = require('../utils/constx.js');
var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  params = params || {};
  
  var config = lodash.pick(params.configuration || {}, ['elasticsearch']);
  
  var es_conf = config['elasticsearch'] || {};

  self.es_url = util.format('%s://%s:%s/', es_conf.protocol || 'http', es_conf.host, es_conf.port);
  self.es_index_url = self.es_url + es_conf.name + '/';
  self.es_structure = es_conf.structure;
  
  self.getSandboxName = function() {
    return params.sandboxname;
  };
};

Service.argumentSchema = {
  "id": "/elasticsearchHelper",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "configuration": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

Service.prototype.getClusterStats = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .get(self.es_url + '_cluster/stats')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - request to cluster/stats is error: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        logger.trace('<%s> - elasticsearch cluster is good: %s', self.getSandboxName(), res.status);
        resolve(res.body);
      }
    });
  });
};

Service.prototype.checkIndexAvailable = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .head(self.es_index_url)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - request to index is error: %s', self.getSandboxName(), err);
        reject(404);
      } else {
        if (res.status >= 400) {
          logger.trace('<%s> - index is not exist: %s', self.getSandboxName(), res.status);
          reject(res.status);
        } else {
          logger.trace('<%s> - index is exist: %s', self.getSandboxName(), res.status);
          resolve();
        }
      }
    });
  });
};

Service.prototype.getIndexSettings = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .get(self.es_index_url + '_settings')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - request to index/_settings is error: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        logger.trace('<%s> - success on getting index/_settings: %s', self.getSandboxName(), res.status);
        resolve(res.body);
      }
    });
  });
};

Service.prototype.getIndexMappings = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .get(self.es_index_url + '_mappings')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - request to index/_mappings is error: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        logger.trace('<%s> - success on getting index/_mappings: %s', self.getSandboxName(), res.status);
        resolve(res.body);
      }
    });
  });
};


Service.prototype.dropIndex = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .del(self.es_index_url)
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - Error on drop index: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        var result = res.body;
        logger.trace('<%s> - Result of drop index: %s', self.getSandboxName(), JSON.stringify(result, null, 2));
        resolve();
      }
    });
  });
};

Service.prototype.initIndex = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .post(self.es_index_url)
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(self.es_structure)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - Error on init index: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        var result = res.body;
        logger.trace('<%s> - Result of index init: %s', self.getSandboxName(), JSON.stringify(result, null, 2));
        resolve();
      }
    });
  });
};

Service.prototype.resetIndex = function() {
  var self = this;
  return Promise.resolve().then(function() {
    return self.checkIndexAvailable();
  }).then(function() {
    return self.dropIndex();
  }, function(reason) {
    return Promise.resolve();
  }).then(function() {
    return self.initIndex();
  });
};


Service.prototype.checkTypeAvailable = function(type) {
  var self = this;
  return Promise.promisify(function(done) {
    superagent
    .head(self.es_index_url + type)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - request to %s type is error: %s', self.getSandboxName(), type, err);
        done(404);
      } else if (res.status >= 400) {
        logger.trace('<%s> - %s type is not exist: %s', self.getSandboxName(), type, res.status);
        done(res.status);
      } else {
        logger.trace('<%s> - %s type is exist: %s', self.getSandboxName(), type, res.status);
        done(null);
      }
    });
  })();
};

Service.prototype.dropType = function(type) {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .del(self.es_index_url + type)
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - Error on delete elasticsearch type %s: %s', self.getSandboxName(), type, err);
        reject(err);
      } else {
        var result = res.body;
        logger.trace('<%s> - Result of elasticsearch %s deletion: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        resolve();
      }
    });
  });
};

Service.prototype.initType = function(type) {
  var self = this;
  var mapping = {};
  
  mapping[type] = self.es_structure.mappings[type];
  
  return new Promise(function(resolve, reject) {
    superagent
    .put(self.es_index_url + type + '/_mapping')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(mapping)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - Error on mapping type %s: %s', self.getSandboxName(), type, err);
        reject(err);
      } else {
        var result = res.body;
        logger.trace('<%s> - Success on mapping type %s: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        resolve();
      }
    });
  });
};

Service.prototype.resetType = function(type) {
  var self = this;
  return Promise.resolve().then(function() {
    return self.checkTypeAvailable(type);
  }).then(function resolved() {
    return self.dropType(type);
  }, function rejected() {
    return Promise.resolve();
  }).then(function() {
    return self.initType(type);
  });
};

Service.prototype.findDocuments = function(type, queryObject) {
  var self = this;
  return Promise.promisify(function(done) {
    logger.trace('<%s> + find %s documents with queryObject: %s', self.getSandboxName(), type, JSON.stringify(queryObject));
    superagent
    .post(self.es_index_url + type + '/_search')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(queryObject)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - Error on %s document finding: %s', self.getSandboxName(), type, err);
        done(err, null);
      } else {
        var result = res.body;
        logger.trace('<%s> - Success on %s document finding: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};

Service.prototype.checkDocumentAvailable = function(type, documentId) {
  var self = this;
  return Promise.promisify(function(done) {
    superagent
    .head(self.es_index_url + type + '/' + documentId)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - request to document %s of %s type is error: %s', self.getSandboxName(), documentId, type, err);
        done(500);
      } else if (res.status >= 400) {
        logger.trace('<%s> - Document %s of %s type is not exist: %s', self.getSandboxName(), documentId, type, res.status);
        done(res.status);
      } else {
        logger.trace('<%s> - Document %s of %s type is exist: %s', self.getSandboxName(), documentId, type, res.status);
        done(null);
      }
    });
  })();
};

Service.prototype.insertDocument = function(type, document) {
  var self = this;
  return Promise.promisify(function(done) {
    logger.trace('<%s> + %s document will be inserted: %s', self.getSandboxName(), type, JSON.stringify(document));
    superagent
    .put(self.es_index_url + type + '/' + document._id)
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(document)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - Error on %s document inserting: %s', self.getSandboxName(), type, err);
        done(err, null);
      } else {
        var result = res.body;
        logger.trace('<%s> - Success on %s document inserting: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};

Service.prototype.updateDocument = function(type, document) {
  var self = this;
  return Promise.promisify(function(done) {
    logger.trace('<%s> + %s document will be updated: %s', self.getSandboxName(), type, JSON.stringify(document));

    superagent
    .post(self.es_index_url + type + '/' + document._id + '/_update')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send({
      doc: document
    })
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - Error on %s document updating: %s', self.getSandboxName(), type, err);
        done(err);
      } else {
        var result = res.body;
        logger.trace('<%s> - Success on %s document updating: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};

Service.prototype.deleteDocument = function(type, document) {
  var self = this;
  return Promise.promisify(function(done) {
    logger.trace('<%s> + %s document will be deleted: %s', self.getSandboxName(), type, JSON.stringify(document));
    superagent
    .del(self.es_index_url + type + '/' + document._id)
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .end(function(err, res) {
      if (err) {
        logger.trace('<%s> - Error on %s document deleting: %s', self.getSandboxName(), type, err);
        done(err, null);
      } else {
        var result = res.body;
        logger.trace('<%s> - Success on %s document deleting: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};


module.exports = Service;