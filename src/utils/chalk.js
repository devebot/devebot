'use strict';

const toolset = require('./toolset');

function Chalk(params = {}) {
  const themes = params.themes || {};

  if (params.blanked !== true && toolset.has('colors')) {
    const colors = toolset.get('colors');
    colors.setTheme(themes);
    return colors;
  }

  const self = this;
  Object.keys(themes).forEach(function(name) {
    self[name] = function(str) { return str; }
  });
}

module.exports = Chalk;
