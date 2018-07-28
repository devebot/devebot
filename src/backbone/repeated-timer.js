'use strict';

const lodash = require('lodash');
const events = require('events');
const util = require('util');
const chores = require('../utils/chores');
const blockRef = chores.getBlockRef(__filename);

const MIN_PERIOD = 10;
const MIN_OFFSET = 0;

function RepeatedTimer(kwargs={}) {
  events.EventEmitter.call(this);

  let loggingFactory = kwargs.loggingFactory.branch(blockRef);
  let LX = loggingFactory.getLogger();
  let LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let self = this;
  let config = lodash.pick(kwargs, ['target', 'period', 'offset', 'total', 'activated', 'name']);

  config.target = config.target || function() {};

  if (!lodash.isFunction(config.target)) {
    throw new Error('target must be a function');
  }

  config.total = config.total || 0;
  config.period = standardizeInt(MIN_PERIOD, config.period || 1000);
  config.offset = standardizeInt(MIN_OFFSET, config.offset || 0);

  let taskHandler = null;
  let taskCounter = 0;

  let taskWrapper = function() {
    taskCounter++;
    if (0 == config.total || taskCounter <= config.total) {
      config.target.call(self);
    } else {
      self.stop();
    }
  };

  let startTime, finishTime;

  this.start = function() {
    LX.has('trace') && LX.log('trace', LT.toMessage({
      tags: [ blockRef, 'starting' ],
      text: 'RepeatedTimer daemon is starting'
    }));
    this.emit('started', {});
    return this.startInSilent();
  }

  this.startInSilent = function() {
    if (0 < config.total && config.total < taskCounter) {
      return this;
    }
    if (!taskHandler) {
      let taskFunction = taskWrapper;
      if (config.offset > 0) {
        taskFunction = function() {
          setTimeout(taskWrapper, lodash.random(0, config.offset));
        };
      }
      taskHandler = setInterval(taskFunction, config.period);
      startTime = new Date();
    }
    return this;
  }

  this.stop = function() {
    LX.has('trace') && LX.log('trace', LT.toMessage({
      tags: [ blockRef, 'stopping' ],
      text: 'RepeatedTimer daemon will be stopped'
    }));
    this.emit('stopped', {});
    return this.stopInSilent();
  }

  this.stopInSilent = function() {
    if (taskHandler) {
      clearInterval(taskHandler);
      taskHandler = null;
      finishTime = new Date();
    }
    return this;
  }

  this.isRunning = function() {
    return (taskHandler != null);
  }

  this.isStopped = function() {
    return (taskHandler == null);
  }

  if (config.activated) this.start();

  Object.defineProperties(this, {
    startTime: {
      get: function() { return startTime }
    },
    finishTime: {
      get: function() { return finishTime }
    },
    uptime: {
      get: function() { return (new Date() - startTime) }
    }
  });

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

util.inherits(RepeatedTimer, events.EventEmitter);

function standardizeInt(min, number) {
  return (number > min) ? number : min;
}

module.exports = RepeatedTimer;
