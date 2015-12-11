'use strict';

var lodash = require('lodash');
var fs = require('fs');
var util = require('util');

var utils = {};

utils.listFiles = function(dir, filenames) {
  filenames = filenames || [];
  var files = fs.readdirSync(dir);
  for (var i in files) {
    var name = dir + '/' + files[i];
    if (fs.statSync(name).isFile()) {
      filenames.push(files[i]);
    }
  }
  return filenames;
};

utils.buildElasticsearchUrl = function(protocol, host, port, name) {
  if (lodash.isObject(protocol)) {
    var es_conf = protocol;
    protocol = es_conf.protocol;
    host = es_conf.host;
    port = es_conf.port;
    name = es_conf.name;
  }
  if (name) {
    return util.format('%s://%s:%s/%s/', protocol || 'http', host, port, name);
  } else {
    return util.format('%s://%s:%s/', protocol || 'http', host, port);
  }
};

utils.buildMongodbUrl = function(host, port, name) {
  if (lodash.isObject(host)) {
    var mongodb_conf = host;
    host = mongodb_conf.host;
    port = mongodb_conf.port;
    name = mongodb_conf.name;
  }
  return util.format('mongodb://%s:%s/%s', host, port, name);
};


module.exports = utils;