'use strict';

const block = require('./block');

function Toolset() {
  const box = block(function() {
    try {
      return require('devebot-tools');
    } catch(error) {
      return {};
    }
  });

  this.has = function(packageName) {
    return box[packageName] !== null && box[packageName] !== undefined;
  }

  this.get = function(packageName) {
    return box[packageName];
  }
}

module.exports = new Toolset();
