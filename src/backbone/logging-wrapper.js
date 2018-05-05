'use strict';

const lodash = require('lodash');
const LogAdapter = require('logolite').LogAdapter;
const LogTracer = require('logolite').LogTracer;
const chores = require('../utils/chores');
const constx = require('../utils/constx');

function LoggingWrapper(sectorName) {
  sectorName = sectorName || chores.getBlockRef(__filename);

  let __logger = null;
  this.getLogger = function() {
    return __logger = __logger || LogAdapter.getLogger({
      sector: sectorName,
      target: 'conlog'
    });
  }

  let __tracer = null;
  this.getTracer = function() {
    if (__tracer == null) {
      let parentTracer = LogTracer.ROOT;
      __tracer = parentTracer.branch({
        key: constx.TRACER.SECTOR.ID_FIELD,
        value: LogTracer.getLogID()
      });

      let blockInfo = {
        parentKey: parentTracer.key,
        parentValue: parentTracer.value
      }
      blockInfo[constx.TRACER.SECTOR.NAME_FIELD] = sectorName;

      let rootLogger = this.getLogger();
      rootLogger.has('info') && rootLogger.log('info', __tracer.add(blockInfo)
          .toMessage({ tags: [ 'devebot-metadata' ] }));
    }
    return __tracer;
  }

  return this;
}

module.exports = LoggingWrapper;
