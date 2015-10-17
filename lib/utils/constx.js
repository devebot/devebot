'use strict';

var constx = {
  MIME_JSON: 'application/json',
  APPINFO: {
    FIELDS: ['version', 'name', 'description', 'homepage', 'author', 'license']
  },
  CMDSET: {
    INDEX_ALL: 'index-all',
    RANDOM_DATA: 'random-data',
    BACKUP_DATA: 'backup-data'
  },
  RUNHOOK: {
    ROOT_KEY: 'runhook',
    KEY: {
      MARKUP: 'index',
      MOCKIT: 'mockit',
      OPLOG: 'oplog'
    },
    MSG: {
      'BEGIN': ' - In [%s], start to [%s] an item of [%s] document: %s',
      'RESULT': ' -> in [%s], [%s] the item [%s] document [%s], oplog result: %s',
      'ERROR': ' -> in [%s], [%s] the item [%s] document [%s], oplog error: %s',
      'END': ' -> in [%s], finish to [%s] the item [%s] document: %s',
      'NOOP': ' -> in [%s], operation [%s] on the item [%s] document: %s is not defined'
    }
  }
};

module.exports = constx;