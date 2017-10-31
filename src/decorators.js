module.exports.throttle = function(callback, limit) {
  var wait = false;
  return function() {
    if (!wait) {
      callback.apply(null, arguments);
      wait = true;
      setTimeout(function() {
        wait = false;
      }, limit);
    }
  };
};
