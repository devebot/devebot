'use strict';

const path = require('path');
const fs = require('fs');
const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const blockRef = chores.getBlockRef(__filename);

function SecurityManager(params={}) {
  let self = this;
  let loggingFactory = params.loggingFactory.branch(blockRef);
  let L = loggingFactory.getLogger();
  let T = loggingFactory.getTracer();
  let CTX = {L, T};

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let authenCfg = lodash.get(params, ['profileConfig', constx.FRAMEWORK.NAME, 'authen'], {});

  self.authenticate = function(tokens) {
    let output = Promise.resolve({ result: true });

    L.has('silly') && L.log('silly', T.add({
      tokens: tokens,
      status: authenCfg.disabled ? 'skipped':'processing'
    }).toMessage({
      tags: [ blockRef, 'authenticate', 'check' ],
      text: ' - authenticate(${tokens}): ${status}'
    }));

    if (authenCfg.disabled) return output;

    return loadTokenStore(CTX, authenCfg.tokenStoreFile).then(function(store) {
      let storeTokens = store.tokens || [];
      for(let i=0; i<storeTokens.length; i++) {
        let storeToken = storeTokens[i];
        if (storeToken.key && storeToken.key == tokens['x-token-key'] &&
            storeToken.secret == tokens['x-token-secret']) {
          return output;
        }
      }
      return Promise.resolve({ result: false, code: 401, name: 'Token Not Found'});
    });
  };

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

SecurityManager.argumentSchema = {
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

module.exports = SecurityManager;

let loadTokenStore = function(ctx, storefile) {
  let {L, T} = ctx;
  let readFile = Promise.promisify(fs.readFile);
  return readFile(storefile, 'utf8').then(function(text) {
    let data = JSON.parse(text);
    if (lodash.isEmpty(data.tokens) || !lodash.isArray(data.tokens)) {
      L.has('silly') && L.log('silly', T.add({
        storefile: storefile
      }).toMessage({
        tags: [ blockRef, 'loadTokenStore', 'invalid' ],
        text: ' - invalid tokenStore ({storefile}), "tokens" must be an array'
      }));
      return {};
    }
    L.has('silly') && L.log('silly', T.add({
      storefile: storefile,
      tokenTotal: data.tokens.length
    }).toMessage({
      tags: [ blockRef, 'loadTokenStore', 'ok' ],
      text: ' - tokenStore ({storefile}) has {tokenTotal} items'
    }));
    return data;
  }).catch(function(err) {
    L.has('silly') && L.log('silly', T.add({
      storefile: storefile,
      errorCode: err.code,
      errorName: err.name || 'Error',
      errorMessage: err.message
    }).toMessage({
      tags: [ blockRef, 'loadTokenStore', 'error' ],
      text: ' - tokenStore ({storefile}) loading is failed. {errorName}: {errorMessage}'
    }));
    return {};
  });
};
