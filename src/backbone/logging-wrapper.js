'use strict';

var lodash = require('lodash');
var LogAdapter = require('logolite').LogAdapter;
var LogTracer = require('logolite').LogTracer;
var chores = require('../utils/chores.js');

var Service = function(sectorName) {
  sectorName = sectorName || chores.getBlockRef(__filename);

  var __logger = null;
  this.getLogger = function() {
    return __logger = __logger || LogAdapter.getLogger({
      sector: sectorName,
      target: 'conlog'
    });
  }

  var __tracer = null;
  this.getTracer = function() {
    if (__tracer == null) {
      var parentTracer = LogTracer.ROOT;
      __tracer = parentTracer.branch({
        key: chores.DEFAULT_SECTOR_ID_FIELD,
        value: LogTracer.getLogID()
      });

      var blockInfo = {
        parentKey: parentTracer.key,
        parentValue: parentTracer.value
      }
      blockInfo[chores.DEFAULT_SECTOR_NAME_FIELD] = sectorName;

      var rootLogger = this.getLogger();
      rootLogger.has('info') && rootLogger.log('info', __tracer.add(blockInfo)
          .toMessage({ tags: [ 'devebot-metadata' ] }));
    }
    return __tracer;
  }

  return this;
}

module.exports = Service;
