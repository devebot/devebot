'use strict';

var events = require('events');
var util = require('util');
var Promise = require('bluebird');
var lodash = require('lodash');
var superagent = require('superagent');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var Service = function(params) {
  params = params || {};
  
  var self = this;
  
  var loggingFactory = params.loggingFactory;
  self.logger = loggingFactory.getLogger();

  var config = params.sandboxconfig || {};

  var es_conf = config['elasticsearch'] || {};
  self.es_url = chores.buildElasticsearchUrl(es_conf.protocol, es_conf.host, es_conf.port);
  self.es_index_url = self.es_url + es_conf.name + '/';
  self.es_structure = es_conf.structure;
  
  self.getSandboxName = function() {
    return params.sandboxname;
  };
  
  self.getServiceInfo = function() {
    var conf = lodash.pick(es_conf, ['protocol', 'host', 'port', 'name']);
    return {
      connection_info: conf,
      url: self.es_index_url,
    };
  };
};

Service.argumentSchema = {
  "id": "/elasticsearchHelper",
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

Service.prototype.getClusterStats = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .get(self.es_url + '_cluster/stats')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .end(function(err, res) {
      if (err) {
        self.logger.info('<%s> - request to cluster/stats is error: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        self.logger.info('<%s> - elasticsearch cluster is good: %s', self.getSandboxName(), res.status);
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
        self.logger.info('<%s> - request to index is error: %s', self.getSandboxName(), err);
        reject(404);
      } else {
        if (res.status >= 400) {
          self.logger.info('<%s> - index is not exist: %s', self.getSandboxName(), res.status);
          reject(res.status);
        } else {
          self.logger.info('<%s> - index is exist: %s', self.getSandboxName(), res.status);
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
        self.logger.info('<%s> - request to index/_settings is error: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        self.logger.info('<%s> - success on getting index/_settings: %s', self.getSandboxName(), res.status);
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
        self.logger.info('<%s> - request to index/_mappings is error: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        self.logger.info('<%s> - success on getting index/_mappings: %s', self.getSandboxName(), res.status);
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
        self.logger.info('<%s> - Error on drop index: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Result of drop index: %s', self.getSandboxName(), JSON.stringify(result, null, 2));
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
        self.logger.info('<%s> - Error on init index: %s', self.getSandboxName(), err);
        reject(err);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Result of index init: %s', self.getSandboxName(), JSON.stringify(result, null, 2));
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
        self.logger.info('<%s> - request to %s type is error: %s', self.getSandboxName(), type, err);
        done(404);
      } else if (res.status >= 400) {
        self.logger.info('<%s> - %s type is not exist: %s', self.getSandboxName(), type, res.status);
        done(res.status);
      } else {
        self.logger.info('<%s> - %s type is exist: %s', self.getSandboxName(), type, res.status);
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
        self.logger.info('<%s> - Error on delete elasticsearch type %s: %s', self.getSandboxName(), type, err);
        reject(err);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Result of elasticsearch %s deletion: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
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
        self.logger.info('<%s> - Error on mapping type %s: %s', self.getSandboxName(), type, err);
        reject(err);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Success on mapping type %s: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
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

Service.prototype.countDocuments = function(type, queryObject) {
  var self = this;
  if (!lodash.isObject(queryObject)) queryObject = {query: {match_all: {}}};
  return Promise.promisify(function(done) {
    self.logger.info('<%s> + count %s documents with queryObject: %s', self.getSandboxName(), type, JSON.stringify(queryObject));
    superagent
    .post(self.es_index_url + type + '/_count')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(queryObject)
    .end(function(err, res) {
      if (err) {
        self.logger.info('<%s> - Error on %s document counting: %s', self.getSandboxName(), type, err);
        done(err, null);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Success on %s document counting: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};

Service.prototype.findDocuments = function(type, queryObject) {
  var self = this;
  return Promise.promisify(function(done) {
    self.logger.info('<%s> + find %s documents with queryObject: %s', self.getSandboxName(), type, JSON.stringify(queryObject));
    superagent
    .post(self.es_index_url + type + '/_search')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(queryObject)
    .end(function(err, res) {
      if (err) {
        self.logger.info('<%s> - Error on %s document finding: %s', self.getSandboxName(), type, err);
        done(err, null);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Success on %s document finding: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
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
        self.logger.info('<%s> - request to document %s of %s type is error: %s', self.getSandboxName(), documentId, type, err);
        done(500);
      } else if (res.status >= 400) {
        self.logger.info('<%s> - Document %s of %s type is not exist: %s', self.getSandboxName(), documentId, type, res.status);
        done(res.status);
      } else {
        self.logger.info('<%s> - Document %s of %s type is exist: %s', self.getSandboxName(), documentId, type, res.status);
        done(null);
      }
    });
  })();
};

Service.prototype.insertDocument = function(type, document) {
  var self = this;
  return Promise.promisify(function(done) {
    self.logger.info('<%s> + %s document will be inserted: %s', self.getSandboxName(), type, JSON.stringify(document));
    superagent
    .put(self.es_index_url + type + '/' + document._id)
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(document)
    .end(function(err, res) {
      if (err) {
        self.logger.info('<%s> - Error on %s document inserting: %s', self.getSandboxName(), type, err);
        done(err, null);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Success on %s document inserting: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};

Service.prototype.updateDocument = function(type, document) {
  var self = this;
  var update_doc = Promise.promisify(function(done) {
    var postdata = {};
    postdata.doc = lodash.omit(document, ['_id', '_extension']);
    
    self.logger.info('<%s> + %s document will be updated: %s', self.getSandboxName(), type, JSON.stringify(postdata));
    
    if (lodash.isEmpty(postdata.doc)) return done(null, {});
    
    superagent
    .post(self.es_index_url + type + '/' + document._id + '/_update')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(postdata)
    .end(function(err, res) {
      if (err) {
        self.logger.info('<%s> - Error on %s document updating: %s', self.getSandboxName(), type, err);
        done(err);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Success on %s document updating: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  });
  
  var update_script = Promise.promisify(function(done) {
    var postdata = {};
    if (document._extension && document._extension.script) {
      postdata.script = document._extension.script;
    }
    
    self.logger.info('<%s> + %s script will be run: %s', self.getSandboxName(), type, JSON.stringify(postdata));

    if (lodash.isEmpty(postdata.script)) return done(null, {});

    superagent
    .post(self.es_index_url + type + '/' + document._id + '/_update')
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .send(postdata)
    .end(function(err, res) {
      if (err) {
        self.logger.info('<%s> - Error on %s script running: %s', self.getSandboxName(), type, err);
        done(err);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Success on %s script running: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  });
  
  return Promise.mapSeries([update_doc, update_script], function(item) {
    return item();
  });
};

Service.prototype.deleteDocument = function(type, document) {
  var self = this;
  return Promise.promisify(function(done) {
    self.logger.info('<%s> + %s document will be deleted: %s', self.getSandboxName(), type, JSON.stringify(document));
    superagent
    .del(self.es_index_url + type + '/' + document._id)
    .type(constx.MIME_JSON)
    .accept(constx.MIME_JSON)
    .end(function(err, res) {
      if (err) {
        self.logger.info('<%s> - Error on %s document deleting: %s', self.getSandboxName(), type, err);
        done(err, null);
      } else {
        var result = res.body;
        self.logger.info('<%s> - Success on %s document deleting: %s', self.getSandboxName(), type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};


module.exports = Service;