'use strict';

function Toolset() {
  let box = {};

  try {
    box = require('devebot-tools');
  } catch(error) {}

  this.has = function(packageName) {
    return box[packageName] !== null && box[packageName] !== undefined;
  }

  this.get = function(packageName) {
    return box[packageName];
  }
}

module.exports = new Toolset();
