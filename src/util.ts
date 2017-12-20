import { Event } from "vscode";

export interface BaseDisposable {
  dispose(): void;
}

export function done<T>(promise: Promise<T>): Promise<void> {
  return promise.then<void>(() => void 0);
}
export function anyEvent<T>(...events: Event<T>[]): Event<T> {
  return (listener, thisArgs = null, disposables?) => {
    const result = combinedDisposable(
      events.map(event => event(i => listener.call(thisArgs, i)))
    );

    if (disposables) {
      disposables.push(result);
    }

    return result;
  };
}

export function filterEvent<T>(
  event: Event<T>,
  filter: (e: T) => boolean
): Event<T> {
  return (listener, thisArgs = null, disposables?) =>
    event(e => filter(e) && listener.call(thisArgs, e), null, disposables);
}

export function dispose(disposables: any[]): any[] {
  disposables.forEach(disposable => disposable.dispose());

  return [];
}

export function combinedDisposable(
  disposables: BaseDisposable[]
): BaseDisposable {
  return toDisposable(() => dispose(disposables));
}

export function toDisposable(dispose: () => void): BaseDisposable {
  return { dispose };
}
