'use strict';

var lodash = require('lodash');
var events = require('events');
var util = require('util');
var chores = require('../utils/chores.js');

var RepeatedTimer = function(kwargs) {
  events.EventEmitter.call(this);

  kwargs = kwargs || {};

  var blockRef = chores.getBlockRef(__filename);
  var loggingFactory = kwargs.loggingFactory.branch(blockRef);
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  var self = this;
  var config = lodash.pick(kwargs, ['target', 'period', 'offset', 'total', 'activated', 'name']);

  config.target = config.target || function() {};

  if (!lodash.isFunction(config.target)) {
    throw new Error('target must be a function');
  }

  config.total = config.total || 0;
  config.period = standardizeInt(MIN_PERIOD, config.period || 1000);
  config.offset = standardizeInt(MIN_OFFSET, config.offset || 0);

  var taskHandler = null;
  var taskCounter = 0;

  var taskWrapper = function() {
    taskCounter++;
    if (0 == config.total || taskCounter <= config.total) {
      config.target.call(self);
    } else {
      self.stop();
    }
  };

  var startTime, finishTime;

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
      var taskFunction = taskWrapper;
      if (config.offset > 0) {
        taskFunction = function() {
          setTimeout(taskWrapper, getRandomInt(0, config.offset));
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

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

var MIN_PERIOD = 10;
var MIN_OFFSET = 0;

module.exports = RepeatedTimer;
