'use strict';

var lodash = require('lodash');
var chores = require('../utils/chores');

var Validator = require('schemato').Validator;
var validator = new Validator({ schemaVersion: 4 });

function SchemaValidator(params) {
  var self = this;
  params = params || {};

  var blockRef = chores.getBlockRef(__filename);
  var loggingFactory = params.loggingFactory.branch(blockRef);
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  self.validate = function(object, schema) {
    var result = validator.validate(object, schema);
    if (typeof result.ok === 'boolean') {
      result.valid = result.ok;
    }
    return result;
  }

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

SchemaValidator.argumentSchema = {
  "$id": "schemaValidator",
  "type": "object",
  "properties": {
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = SchemaValidator;