module.exports = {
  devebot: {
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
