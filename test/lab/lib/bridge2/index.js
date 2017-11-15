'use strict';

var Devebot = require('../../index').getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var dgx = debug('devebot:test:lab:bridge2');

var Service = function(params) {
  dgx.enabled && dgx(' + constructor start ...');

  params = params || {};

  dgx.enabled && dgx(' - params: %s', JSON.stringify(params, null, 2));

  dgx.enabled && dgx(' - constructor end!');
};

module.exports = Service;
