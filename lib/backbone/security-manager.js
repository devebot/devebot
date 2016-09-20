'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
var lodash = require('lodash');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');
var debuglog = require('../utils/debug.js')('devebot:securityManager');

var Service = function(params) {
  debuglog.isEnabled && debuglog(' + constructor start ...');

  var self = this;
  params = params || {};

  var authenCfg = lodash.get(params, ['profileConfig', 'devebot', 'authen'], {});

  self.authenticate = function(tokens) {
    var output = Promise.resolve({ result: true });

    debuglog.isEnabled && debuglog(' - authenticate(%s): %s', JSON.stringify(tokens),
        authenCfg.disabled ? 'skipped':'processing');

    if (authenCfg.disabled) return output;

    return loadTokenStore(authenCfg.tokenStoreFile).then(function(store) {
      var storeTokens = store.tokens || [];
      for(var i=0; i<storeTokens.length; i++) {
        var storeToken = storeTokens[i];
        if (storeToken.key && storeToken.key == tokens['x-token-key'] &&
            storeToken.secret == tokens['x-token-secret']) {
          return output;
        }
      }

      return Promise.resolve({ result: false, code: 401, name: 'Token Not Found'});
    });
  };

  var loadTokenStore = function(storefile) {
    var readFile = Promise.promisify(fs.readFile);
    return readFile(storefile, 'utf8').then(function(text) {
      var data = JSON.parse(text);
      if (lodash.isEmpty(data.tokens) || !lodash.isArray(data.tokens)) {
        debuglog.isEnabled && debuglog(' - invalid tokenStore (%s), "tokens" must be an array', storefile);
        return {};
      }
      debuglog(' - tokenStore (%s) has %s items', storefile, data.tokens.length);
      return data;
    }).catch(function(err) {
      debuglog.isEnabled && debuglog(' - tokenStore loading has failed. Error: %s', JSON.stringify(err));
      return {};
    });
  };

  debuglog.isEnabled && debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "securityManager",
  "type": "object",
  "properties": {
    "profileConfig": {
      "type": "object"
    },
    "generalConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = Service;
