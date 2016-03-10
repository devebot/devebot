module.exports = function(pkgName) {
  var log = (process.env.DEBUG) ? require('debug')(pkgName) : function() {};
  log.isEnabled = process.env.DEBUG;
  return log;
};
