'use strict';

module.exports = function(envName, defaultValue) {
  if (!envName in process.env) {
    return defaultValue;
  }
  return process.env[envName] || defaultValue;
}
