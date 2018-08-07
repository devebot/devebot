'use strict';

const lodash = require('lodash');
const chores = require('../utils/chores');
const blockRef = chores.getBlockRef(__filename);

function SchemaValidator(params={}) {
  let self = this;
  let loggingFactory = params.loggingFactory.branch(blockRef);
  let LX = loggingFactory.getLogger();
  let LT = loggingFactory.getTracer();
  let validator;

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  self.validate = function(object, schema) {
    validator = validator || chores.getValidator();
    let result = validator.validate(object, schema);
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