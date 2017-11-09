# devebot

[![NPM](https://nodei.co/npm/devebot.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/devebot/)

> Nodejs Microservice Framework

## Usage

Installs `devebot` module:

```shell
$ npm install --save devebot
```

Create your `app.js` source file, and appends the following block:

```javascript
var Devebot = require('devebot');

var app = Devebot({
  appRootPath: __dirname
});

// start the server if run `$ node app.js`
if (require.main === module) app.server.start();

module.exports = app;
```
