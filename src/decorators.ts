export function debounce(func: Function, wait: number, context: any) {
  let timer: any = null;

  return function(...args: any[]) {
    clearTimeout(timer);

    timer = setTimeout(() => {
      func.apply(context, ...args);
    }, wait);
  };
}

export function throttleAsync(fn: Function, key: string, context: any) {
  //   const currentKey = `$throttle$current$${key}`;
  //   const nextKey = `$throttle$next$${key}`;
  //   const trigger = function(...args: any[]) {
  //     if (this[nextKey]) {
  //       return this[nextKey];
  //     }
  //     if (this[nextKey]) {
  //       done(this[currentKey]).then(() => {
  //         this[nextKey] = false;
  //         return trigger.apply(context, ...args);
  //       });
  //       return this[nextKey];
  //     }
  //     this[currentKey] = fn.apply(context, args);
  //     this[currentKey].then(() => {
  //       this[currentKey] = false;
  //     });
  //     return this[currentKey];
  //   };
  //   return trigger;
}

function done(promise: Promise<void>) {
  return promise.then(() => void 0);
}
