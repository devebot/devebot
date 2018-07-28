'use strict';

const toolset = require('./toolset');

function Chalk(params={}) {
  let themes = params.themes || {};

  if (params.blanked !== true && toolset.has('colors')) {
    let colors = toolset.get('colors');
    colors.setTheme(themes);
    return colors;
  }

  let self = this;
  Object.keys(themes).forEach(function(name) {
    self[name] = function(str) { return str; }
  });
}

module.exports = Chalk;
