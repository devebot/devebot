'use strict';

var fs = require('fs');
var path = require('path');

var utils = {};

utils.listConfigFiles = function(dir, files_) {
  files_ = files_ || [];
  var files = fs.readdirSync(dir);
  for (var i in files) {
    var name = dir + '/' + files[i];
    if (fs.statSync(name).isFile()) {
      files_.push(files[i]);
    }
  }
  return files_;
};

module.exports = utils;