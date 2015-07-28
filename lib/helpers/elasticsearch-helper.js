'use strict';

var events = require('events');
var util = require('util');
var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');
var superagent = require('superagent');

var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  self.config = lodash.pick(params || {}, ['elasticsearch']);
  
  var es_conf = self.config['elasticsearch'] || {};
  self.es_url = util.format('%s://%s:%s/', es_conf.protocol || 'http', es_conf.host, es_conf.port);
  self.es_index_url = self.es_url + es_conf.name + '/';
};

util.inherits(Service, events.EventEmitter);

Service.prototype.checkIndexAvailable = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .head(self.es_index_url)
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> request to index is error: %s', err);
        reject(404);
      } else {
        if (res.status >= 400) {
          logger.trace(' ->> index is not exist: %s', res.status);
          reject(res.status);
        } else {
          logger.trace(' ->> index is exist: %s', res.status);
          resolve();
        }
      }
    });
  });
};

Service.prototype.dropIndex = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    superagent
    .del(self.es_index_url)
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> Error on drop index: %s', err);
        reject(err);
      } else {
        var result = JSON.parse(res.text);
        logger.trace(' ->> Result of drop index: %s', JSON.stringify(result, null, 2));
        resolve();
      }
    });
  });
};

Service.prototype.initIndex = function() {
  var self = this;
  var index_structure = self.config['elasticsearch'].structure;
  return new Promise(function(resolve, reject) {
    superagent
    .post(self.es_index_url)
    .send(index_structure)
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> Error on init index: %s', err);
        reject(err);
      } else {
        var result = JSON.parse(res.text);
        logger.trace(' ->> Result of index init: ' + JSON.stringify(result, null, 2));
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
        logger.trace(' ->> request to %s type is error: %s', type, err);
        done(404);
      } else if (res.status >= 400) {
        logger.trace(' ->> %s type is not exist: %s', type, res.status);
        done(res.status);
      } else {
        logger.trace(' ->> %s type is exist: %s', type, res.status);
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
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> Error on delete elasticsearch type %s: %s', type, err);
        reject(err);
      } else {
        var result = JSON.parse(res.text);
        logger.trace(' ->> Result of elasticsearch %s deletion: %s', type, JSON.stringify(result, null, 2));
        resolve();
      }
    });
  });
};

Service.prototype.initType = function(type) {
  var self = this;
  var mapping = {};
  
  mapping[type] = self.config['elasticsearch'].structure.mappings[type];
  
  return new Promise(function(resolve, reject) {
    superagent
    .put(self.es_index_url + type + '/_mapping')
    .send(mapping)
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> Error on mapping type %s: %s', type, err);
        reject(err);
      } else {
        var result = JSON.parse(res.text);
        logger.trace(' ->> Success on mapping type %s: %s', type, JSON.stringify(result, null, 2));
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

Service.prototype.checkDocumentAvailable = function(type, documentId) {
  var self = this;
  return Promise.promisify(function(done) {
    superagent
    .head(self.es_index_url + type + '/' + documentId)
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> request to document %s of %s type is error: %s', documentId, type, err);
        done(500);
      } else if (res.status >= 400) {
        logger.trace(' ->> Document %s of %s type is not exist: %s', documentId, type, res.status);
        done(res.status);
      } else {
        logger.trace(' ->> Document %s of %s type is exist: %s', documentId, type, res.status);
        done(null);
      }
    });
  })();
};

Service.prototype.insertDocument = function(type, document) {
  var self = this;
  return Promise.promisify(function(done) {
    logger.trace(' -> %s document will be inserted: %s', type, JSON.stringify(document));
    superagent
    .put(self.es_index_url + type + '/' + document._id)
    .send(document)
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> Error on %s document inserting: %s', type, err);
        done(err, null);
      } else {
        var result = JSON.parse(res.text);
        logger.trace(' ->> Success on %s document inserting: %s', type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};

Service.prototype.updateDocument = function(type, document) {
  var self = this;
  return Promise.promisify(function(done) {
    logger.trace(' -> %s document will be updated: %s', type, JSON.stringify(document));

    superagent
    .post(self.es_index_url + type + '/' + document._id + '/_update')
    .send({
      doc: document
    })
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> Error on %s document updating: %s', type, err);
        done(err);
      } else {
        var result = JSON.parse(res.text);
        logger.trace(' ->> Success on %s document updating: %s', type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};

Service.prototype.deleteDocument = function(type, document) {
  var self = this;
  return Promise.promisify(function(done) {
    logger.trace(' -> %s document will be deleted: %s', type, JSON.stringify(document));
    superagent
    .del(self.es_index_url + type + '/' + document._id)
    .accept('application/json')
    .end(function(err, res) {
      if (err) {
        logger.trace(' ->> Error on %s document deleting: %s', type, err);
        done(err, null);
      } else {
        var result = JSON.parse(res.text);
        logger.trace(' ->> Success on %s document deleting: %s', type, JSON.stringify(result, null, 2));
        done(null, result);
      }
    });
  })();
};


module.exports = Service;