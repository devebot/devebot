'use strict';

var lodash = require('lodash');
var debug = require('../utils/debug.js');
var debugx = debug('devebot:contextMonitor');

function ContextMonitor(params) {
  debugx.enabled && debugx(' + constructor start ...');

  params = params || {};

  var opStates = [];

  this.init = function() {
    opStates.splice(0, opStates.length);
  }

  this.collect = function(info) {
    opStates.push(info);
  }

  this.examine = function() {
    var summary = lodash.reduce(opStates, function(store, item) {
      if (item.hasError) {
        store.numberOfErrors += 1;
        store.failedServices.push(item);
      }
      return store;
    }, { numberOfErrors: 0, failedServices: [] });

    return summary;
  }

  debugx.enabled && debugx(' - constructor has finished');
}

ContextMonitor.argumentSchema = {
  "id": "contextMonitor",
  "type": "object",
  "properties": {}
};

module.exports = ContextMonitor;