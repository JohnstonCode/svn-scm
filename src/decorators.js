module.exports.throttle = function(func, wait, context) {
  var timer = null;

  return function() {
    var args = arguments;

    clearTimeout(timer);

    timer = setTimeout(function() {
      fn.apply(context, args);
    }, wait);
  };
};

module.exports.throttleAsync = function(fn, key, context = this) {
  const currentKey = `$throttle$current$${key}`;
  const nextKey = `$throttle$next$${key}`;

  const trigger = function(...args) {
    if (this[nextKey]) {
      return this[nextKey];
    }

    if (this[currentKey]) {
      done(this[currentKey]).then(() => {
        this[nextKey] = false;
        return trigger.apply(context, args);
      });

      return this[nextKey];
    }

    this[currentKey] = fn.apply(context, args);

    this[currentKey].then(() => {
      this[currentKey] = false;
    });

    return this[currentKey];
  };

  return trigger;
};

function done(promise) {
  return promise.then(() => void 0);
}
