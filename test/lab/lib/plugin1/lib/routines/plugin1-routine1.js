'use strict';

var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');

var runhookSetting;

var runhookDialect = {
  info: {
  	description: 'Plugin1 - Routine1',
    options: []
  },
  mode: 'direct',
  handler: function(opts, payload, ctx) {
    var LX = this.loggingFactory.getLogger();
    var LT = this.loggingFactory.getTracer();

    LX.has('conlog') && LX.log('conlog', LT.add({
      checkpoint: 'plugin1-routine1-begin'
    }).toMessage({
      text: ' - runhook start',
      reset: true
    }));

    var result = { runhookName: 'Plugin1 - Routine1' }

    LX.has('conlog') && LX.log('conlog', LT.add({
      checkpoint: 'plugin1-routine1-injected-names',
      injectedServiceNames: Object.keys(this.injectedServices)
    }).toMessage({
      text: ' - injectedServices names: {injectedServiceNames}',
      reset: true
    }));

    var output = Promise.resolve([{
        type: 'json',
        title: 'Plugin1 - Routine1',
        data: result
    }]);

    LX.has('conlog') && LX.log('conlog', LT.add({
      checkpoint: 'plugin1-routine1-end'
    }).toMessage({
      text: ' - runhook end',
      reset: true
    }));

    return output;
  }
};

module.exports = function(params) {
  runhookSetting = params || {};
  return runhookDialect;
};
