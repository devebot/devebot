'use strict';

const LogAdapter = require('logolite').LogAdapter;
const LogTracer = require('logolite').LogTracer;
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const CHECK = constx.LOGGER.INTERNAL_LEVEL;
const FRAMEWORK_METADATA = constx.FRAMEWORK.NAME + '-metadata';

function LoggingWrapper(sectorName) {
  sectorName = sectorName || chores.getBlockRef(__filename);
  const _ref_ = { logger: null, tracer: null }

  this.getLogger = function() {
    return _ref_.logger = _ref_.logger || LogAdapter.getLogger({
      sector: sectorName,
      target: 'dunce'
    });
  }

  this.getTracer = function() {
    if (_ref_.tracer == null) {
      const parentTracer = LogTracer.ROOT;
      _ref_.tracer = parentTracer.branch({
        key: constx.TRACER.SECTOR.ID_FIELD,
        value: LogTracer.getLogID()
      });

      const blockInfo = {
        parentKey: parentTracer.key,
        parentValue: parentTracer.value
      }
      blockInfo[constx.TRACER.SECTOR.NAME_FIELD] = sectorName;

      const rootLogger = this.getLogger();
      rootLogger.has(CHECK) && rootLogger.log(CHECK, _ref_.tracer
          .add(blockInfo)
          .toMessage({ tags: [ FRAMEWORK_METADATA ] }));
    }
    return _ref_.tracer;
  }

  return this;
}

module.exports = LoggingWrapper;
