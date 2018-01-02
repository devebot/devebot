'use strict';

var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var dgx = Devebot.require('pinbug')('devebot:test:lab:bridge2');

var Service = function(params) {
  dgx.enabled && dgx(' + constructor start ...');

  params = params || {};

  dgx.enabled && dgx(' - params: %s', JSON.stringify(params, null, 2));

  this.logger.has('debug') && this.logger.log('debug', this.tracer.add({
    message: 'configuration',
    data: params
  }).toMessage());

  dgx.enabled && dgx(' - constructor end!');
};

module.exports = Service;
