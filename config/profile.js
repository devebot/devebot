module.exports = {
  devebot: {
    host: '0.0.0.0',
    port: '17779',
    authen: {
      disabled: false,
      tokenStoreFile: __dirname + '/../data/tokenstore.json'
    },
    tunnel: {
      enabled: false,
      key_file: __dirname + '/../data/ssl/example.key',
      crt_file: __dirname + '/../data/ssl/example.crt'
    },
    jobqueue: {
      enabled: false,
      default: 'redis',
      engines: [
        {
          name: 'redis',
          config: {
            host: '127.0.0.1',
            port: 6379,
            name: 'devebotjq'
          }
        }
      ]
    }
  }
};
