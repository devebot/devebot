'use strict';

var lodash = require('lodash');
var chores = require('../utils/chores.js');

var Validator = require('jsonschema').Validator;
var validator = new Validator();
validator.addSchema(require('jsonschema/schema/draft-04/schema.json'));

function SchemaValidator(params) {
  var self = this;
  params = params || {};

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  self.validate = function(object, schema) {
  	return validator.validate(object, schema);
  }

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

SchemaValidator.argumentSchema = {
  "id": "schemaValidator",
  "type": "object",
  "properties": {
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = SchemaValidator;