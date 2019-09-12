'use strict';

const assert = require('assert');
const lodash = require('lodash');
const events = require('events');
const util = require('util');
const chores = require('../utils/chores');
const blockRef = chores.getBlockRef(__filename);

const MIN_PERIOD = 10;
const MIN_OFFSET = 0;

function RepeatedTimer(kwargs={}) {
  events.EventEmitter.call(this);

  const loggingFactory = kwargs.loggingFactory.branch(blockRef);
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  const self = this;
  const config = lodash.pick(kwargs, ['target', 'period', 'offset', 'total', 'activated', 'name']);

  config.target = config.target || function() {};
  config.total = config.total || 0;
  config.period = standardizeInt(MIN_PERIOD, config.period || 1000);
  config.offset = standardizeInt(MIN_OFFSET, config.offset || 0);

  assert.ok(lodash.isFunction(config.target), 'target must be a function');

  const _ref_ = {
    taskHandler: null, taskCounter: 0,
    startTime: null, finishTime: null
  };

  function taskWrapper() {
    _ref_.taskCounter++;
    if (config.total === 0 || _ref_.taskCounter <= config.total) {
      config.target.call(self);
    } else {
      self.stop();
    }
  };

  this.start = function() {
    L.has('trace') && L.log('trace', T.toMessage({
      tags: [ blockRef, 'starting' ],
      text: 'RepeatedTimer daemon is starting'
    }));
    this.emit('started', {});
    return this.startInSilent();
  }

  this.startInSilent = function() {
    if (config.total > 0 && config.total < _ref_.taskCounter) {
      return this;
    }
    if (!_ref_.taskHandler) {
      const taskFunction = (config.offset <= 0) ? taskWrapper : function() {
        setTimeout(taskWrapper, lodash.random(0, config.offset));
      }
      _ref_.taskHandler = setInterval(taskFunction, config.period);
      _ref_.startTime = new Date();
    }
    return this;
  }

  this.stop = function() {
    L.has('trace') && L.log('trace', T.toMessage({
      tags: [ blockRef, 'stopping' ],
      text: 'RepeatedTimer daemon will be stopped'
    }));
    this.emit('stopped', {});
    return this.stopInSilent();
  }

  this.stopInSilent = function() {
    if (_ref_.taskHandler) {
      clearInterval(_ref_.taskHandler);
      _ref_.taskHandler = null;
      _ref_.finishTime = new Date();
    }
    return this;
  }

  this.isRunning = function() {
    return (_ref_.taskHandler != null);
  }

  this.isStopped = function() {
    return (_ref_.taskHandler == null);
  }

  if (config.activated) this.start();

  Object.defineProperties(this, {
    startTime: {
      get: function() { return _ref_.startTime }
    },
    finishTime: {
      get: function() { return _ref_.finishTime }
    },
    uptime: {
      get: function() { return (new Date() - _ref_.startTime) }
    }
  });

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

util.inherits(RepeatedTimer, events.EventEmitter);

function standardizeInt(min, number) {
  return (number > min) ? number : min;
}

module.exports = RepeatedTimer;
