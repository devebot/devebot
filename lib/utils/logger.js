'use strict';

var winston = require('winston');

var NODE_ENV = process.env.NODE_DEVEBOT_ENV || process.env.NODE_ENV;

var logConsoleLevel = 'error';
if (NODE_ENV && NODE_ENV != 'production') {
    logConsoleLevel = 'debug';
}

var acegikLevels = {
  levels: {
    debug: 0,
    info: 1,
    trace: 2,
    warn: 3,
    error: 4
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

var logger = new(winston.Logger)({
    levels: acegikLevels.levels,
    transports: [
        new(winston.transports.Console)({
            json: false,
            timestamp: true,
            colorize: true,
            level: logConsoleLevel
        })
    ],
    exceptionHandlers: [
        new(winston.transports.Console)({
            json: false,
            timestamp: true,
            colorize: true,
            level: logConsoleLevel
        })
    ],
    exitOnError: false
});

module.exports = logger;