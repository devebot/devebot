'use strict';

var Devebot = require('../../../index').getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var debugx = debug('devebot:test:lab:main:mainService');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  var logger = self.logger = params.loggingFactory.getLogger();

  var mainCfg = lodash.get(params, ['sandboxConfig', 'application'], {});
  debugx.enabled && debugx('configuration: %s', JSON.stringify(mainCfg));

  debugx.enabled && debugx(' - constructor end!');
};

Service.argumentSchema = {
  "id": "mainService",
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
    "generalConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = Service;
