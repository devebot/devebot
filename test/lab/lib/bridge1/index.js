'use strict';

var Devebot = require('../../index').getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var dgx = debug('devebot:test:lab:bridge1');

var Service = function(params) {
  dgx.enabled && dgx(' + constructor start ...');

  params = params || {};

  dgx.enabled && dgx(' - constructor end!');
};

Service.argumentSchema = {
  "id": "bridge1",
  "type": "object"
};

module.exports = Service;
