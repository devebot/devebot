'use strict';

var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var Service = function(params) {
  var self = this;
  params = params || {};

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  var authenCfg = lodash.get(params, ['profileConfig', 'devebot', 'authen'], {});

  self.authenticate = function(tokens) {
    var output = Promise.resolve({ result: true });

    LX.has('conlog') && LX.log('conlog', LT.add({
      tokens: tokens,
      status: authenCfg.disabled ? 'skipped':'processing'
    }).toMessage({
      text: ' - authenticate({tokens}): {status}'
    }));

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
        LX.has('conlog') && LX.log('conlog', LT.add({
          storefile: storefile
        }).toMessage({
          text: ' - invalid tokenStore ({storefile}), "tokens" must be an array'
        }));
        return {};
      }
      LX.has('conlog') && LX.log('conlog', LT.add({
        storefile: storefile,
        tokenTotal: data.tokens.length
      }).toMessage({
        text: ' - tokenStore ({storefile}) has {tokenTotal} items'
      }));
      return data;
    }).catch(function(err) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        storefile: storefile,
        errorCode: err.code,
        errorName: err.name || 'Error',
        errorMessage: err.message
      }).toMessage({
        text: ' - tokenStore ({storefile}) loading is failed. {errorName}: {errorMessage}'
      }));
      return {};
    });
  };

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

Service.argumentSchema = {
  "$id": "securityManager",
  "type": "object",
  "properties": {
    "profileConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = Service;
