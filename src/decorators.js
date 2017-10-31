module.exports.throttle = function(func, wait, context, s) {
  var args, result;
  var timeout = null;
  var previous = 0;
  if (!options) options = {};
  var later = function() {
    previous = options.leading === false ? 0 : Date.now();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) args = null;
  };
  return function() {
    var now = Date.now();
    if (!previous && options.leading === false) previous = now;
    var remaining = wait - (now - previous);
    args = arguments;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
      if (!timeout) args = null;
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }
    return result;
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
      this[nextKey] = done(this[currentKey]).then(() => {
        this[nextKey] = undefined;
        return trigger.apply(context, args);
      });

      return this[nextKey];
    }

    this[currentKey] = fn.apply(context, args);

    const clear = () => (this[currentKey] = undefined);
    done(this[currentKey]).then(clear, clear);

    return this[currentKey];
  };

  return trigger;
};

function done(promise) {
  return promise.then(() => void 0);
}
