'use strict';

module.exports = function(envName, defaultValue) {
  if (typeof envName === 'string') {
    if (envName in process.env) {
      return process.env[envName];
    }
  }
  if (envName instanceof Array) {
    for (const i in envName) {
      if (envName[i] in process.env) {
        return process.env[envName[i]];
      }
    }
  }
  return defaultValue;
}
