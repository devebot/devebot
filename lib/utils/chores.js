'use strict';

var lodash = require('lodash');
var util = require('util');

var utils = {};

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

module.exports = utils;