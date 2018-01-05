'use strict';

var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');

var runhookSetting;

var runhookDialect = {
  info: {
    description: 'Plugin2 - Routine1',
    schema: {
      "type": "object",
      "properties": {
        "number": {
          "type": "number",
          "minimum": 0,
          "maximum": 100
        }
      }
    },
    options: []
  },
  handler: function(opts, payload, ctx) {
    var LX = this.loggingFactory.getLogger();
    var LT = this.loggingFactory.getTracer();

    LX.has('conlog') && LX.log('conlog', LT.add({
      checkpoint: 'plugin2-routine1-begin'
    }).toMessage({
      text: ' - runhook start'
    }));

    var number = payload.number;
    var result = fibonacci(number, number, ctx.progressMeter);

    var output = Promise.resolve([{
        type: 'json',
        title: 'Plugin2 - Routine1',
        data: { fibonacci: result }
    }]);

    LX.has('conlog') && LX.log('conlog', LT.add({
      checkpoint: 'plugin2-routine1-end'
    }).toMessage({
      text: ' - runhook end'
    }));

    return output;
  }
};

module.exports = function(params) {
  runhookSetting = params || {};
  return runhookDialect;
};

function fibonacci(n, max, progressMeter) {
  if (progressMeter) {
    progressMeter.update(max - n + 1, max);
  }
  if (n == 0 || n == 1)
    return n;
  else
    return fibonacci(n - 1, max, progressMeter) + fibonacci(n - 2);
}
