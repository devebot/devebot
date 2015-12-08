'use strict';

var events = require('events');
var util = require('util');
var winston = require('winston');
require('winston-mongodb').MongoDB;

var acegikLevels = {
  levels: {
    debug: 4,
    info: 3,
    trace: 2,
    warn: 1,
    error: 0
  },
  colors: {
    debug: 'blue',
    info: 'green',
    trace: 'yellow',
    warn: 'cyan',
    error: 'red'
  }
};

winston.addColors(acegikLevels.colors);

var NODE_ENV = process.env.NODE_DEVEBOT_ENV || process.env.NODE_ENV;

var logConsoleLevel = 'error';
var logFileLevel = 'error';
var logMongodbLevel = 'error';

if (process.env.NODE_DEVEBOT_LOG) {
  logConsoleLevel = process.env.NODE_DEVEBOT_LOG;
} else {
  if (NODE_ENV && NODE_ENV != 'production') {
    logConsoleLevel = 'trace';
  }
}

var Service = function(params) {
  params = params || {};
  
  var self = this;
  
  var tracer = new(winston.Logger)({
    transports: [
      new (winston.transports.MongoDB)({
        db: 'mongodb://127.0.0.1:27027/devebot_logs',
        storeHost: true,
        handleExceptions: true,
        level: logMongodbLevel
      }),
      new(winston.transports.Console)({
        json: false,
        timestamp: true,
        colorize: true,
        handleExceptions: true,
        level: logConsoleLevel
      })
    ]
  });

  tracer.setLevels(acegikLevels.levels);
  tracer.exitOnError = false;
  
  self.getTracer = function() {
    return tracer;
  };
};

Service.argumentSchema = {
  "id": "/loggingFactory",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "configuration": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

var defineLogger = function() {
  var logger = new(winston.Logger)({
    transports: [
      new winston.transports.File({
        json: false,
        filename: 'trace.log',
        maxsize: 1024*1024*5,
        maxFiles: 100,
        handleExceptions: true,
        level: logFileLevel
      }),
      new winston.transports.Console({
        json: false,
        timestamp: true,
        colorize: true,
        handleExceptions: true,
        level: logConsoleLevel
      })
    ],
    exitOnError: false
  });

  logger.setLevels(acegikLevels.levels);
  logger.exitOnError = false;
  
  return logger;
};

Service.defaultLogger = defineLogger();
Service.prototype.defaultLogger = Service.defaultLogger;

module.exports = Service;
