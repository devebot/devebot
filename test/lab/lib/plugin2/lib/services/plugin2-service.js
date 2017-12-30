'use strict';

var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');

var Service = function(params) {
  var self = this;
  params = params || {};

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'test-plugin2', 'constructor-begin' ],
    text: ' + constructor begin'
  }));

  var pluginCfg = lodash.get(params, ['sandboxConfig', 'plugins', 'plugin2'], {});
  LX.has('conlog') && LX.log('conlog', LT.add({
    pluginCfg: pluginCfg
  }).stringify({
    tags: [ 'test-plugin2' ],
    text: ' - configuration: {pluginCfg}'
  }));

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'test-plugin2', 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

Service.argumentSchema = {
  "id": "plugin2Service",
  "type": "object",
  "properties": {
    "sandboxName": {
      "type": "string"
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = Service;
