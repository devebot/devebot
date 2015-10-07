'use strict';

var constx = {
  mime_json: 'application/json',
  CMDSET: {
    RANDOM_DATA: 'random-data',
    BACKUP_DATA: 'backup-data'
  },
  RUNHOOK: {
    KEY: {
      MOCKIT: 'mockit',
      OPLOG: 'oplog'
    },
    MSG: {
      'BEGIN': ' - start to %s an item of %s document: %s',
      'RESULT': ' - > %s the item %s document [%s], oplog result: %s',
      'ERROR': ' - > %s the item %s document [%s], oplog error: %s',
      'END': ' - > finish to %s the item %s document: %s',
      'NOOP': ' - > operation %s on the item %s document: %s is not defined'
    }
  }
};

module.exports = constx;