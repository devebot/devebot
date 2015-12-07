'use strict';

var winston = require('winston');

var NODE_ENV = process.env.NODE_DEVEBOT_ENV || process.env.NODE_ENV;

var logConsoleLevel = 'debug';
if (NODE_ENV && NODE_ENV != 'production') {
    logConsoleLevel = 'trace';
}

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