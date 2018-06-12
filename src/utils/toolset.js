'use strict';

const loader = require('./loader');

function Toolset() {
  let box = loader('devebot-tools', { stopWhenError: false });

  this.has = function(packageName) {
    return box[packageName] !== null && box[packageName] !== undefined;
  }

  this.get = function(packageName) {
    return box[packageName];
  }
}

module.exports = new Toolset();
