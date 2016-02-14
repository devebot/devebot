'use strict';

var lodash = require('lodash');
var fs = require('fs');
var path = require('path');
var util = require('util');

var loader = require('./loader.js');

var utils = {};

utils.listFiles = function(dir, filenames) {
  filenames = filenames || [];
  var files = fs.readdirSync(dir);
  for (var i in files) {
    var name = dir + '/' + files[i];
    if (fs.statSync(name).isFile()) {
      filenames.push(files[i]);
    }
  }
  return filenames;
};

utils.filterFiles = function(dir, filter, filenames) {
  filenames = filenames || [];
  var files = fs.readdirSync(dir);
  var regex = (filter) ? new RegExp(filter) : null;
  for (var i in files) {
    if ((regex) ? regex.test(files[i]) : true) {
      var name = dir + '/' + files[i];
      if (fs.statSync(name).isFile()) {
        filenames.push(files[i]);
      }
    }
  }
  return filenames;
};

utils.buildElasticsearchUrl = function(protocol, host, port, name) {
  if (lodash.isObject(protocol)) {
    var es_conf = protocol;
    protocol = es_conf.protocol;
    host = es_conf.host;
    port = es_conf.port;
    name = es_conf.name;
  }
  if (name) {
    return util.format('%s://%s:%s/%s/', protocol || 'http', host, port, name);
  } else {
    return util.format('%s://%s:%s/', protocol || 'http', host, port);
  }
};

utils.buildMongodbUrl = function(host, port, name, username, password, authSource) {
  if (lodash.isObject(host)) {
    var mongodb_conf = host;
    host = mongodb_conf.host;
    port = mongodb_conf.port;
    name = mongodb_conf.name;
    username = mongodb_conf.username;
    password = mongodb_conf.password;
    authSource = mongodb_conf.authSource;
  }
  
  var mongodb_auth = [];
  if (lodash.isString(username) && username.length > 0) {
    mongodb_auth.push(username);
    if (lodash.isString(password)) {
      mongodb_auth.push(':', password, '@');
    }
  }
  mongodb_auth = mongodb_auth.join('');
  
  var url = util.format('mongodb://%s%s:%s/%s', mongodb_auth, host, port, name);
  
  if (authSource) {
    url = [url, '?authSource=', authSource].join('');
  }
  
  return url;
};

utils.loadScriptEntries = function(scriptMap, scriptFolder, scriptKey, scriptContext) {
  var self = this;
  
  if (self.logger) {
    self.logger.debug(' - load %s from folder: %s', scriptKey, scriptFolder);  
  }

  var scriptFiles = utils.filterFiles(scriptFolder, scriptKey);
  scriptFiles.forEach(function(scriptFile) {
    utils.loadScriptEntry.call(self, scriptMap, scriptFolder, scriptFile, scriptContext);
  });
};

utils.loadScriptEntry = function(scriptMap, scriptFolder, scriptFile, scriptContext) {
  var self = this;
  var filepath = path.join(scriptFolder, scriptFile);
  var scriptInit = loader(filepath);
  if (lodash.isFunction(scriptInit)) {
    var target = scriptInit(scriptContext);
    var entryPath = scriptFile.replace('.js', '').toLowerCase().split('_').reverse();
    entryPath.unshift(target);
    var entry = lodash.reduce(entryPath, function(result, item) {
      var nestEntry = {};
      nestEntry[item] = result;
      return nestEntry;
    });
    lodash.defaultsDeep(scriptMap, entry);
  }
};

module.exports = utils;
