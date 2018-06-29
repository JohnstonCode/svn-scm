import { sep } from "path";
import { Event } from "vscode";
import { Operation } from "./common/types";

export interface IDisposable {
  dispose(): void;
}

export function done<T>(promise: Promise<T>): Promise<void> {
  return promise.then<void>(() => void 0);
}
export function anyEvent<T>(...events: Array<Event<T>>): Event<T> {
  return (listener: any, thisArgs = null, disposables?: any) => {
    const result = combinedDisposable(
      events.map(event => event((i: any) => listener.call(thisArgs, i)))
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
  return (listener: any, thisArgs = null, disposables?: any) =>
    event(
      (e: any) => filter(e) && listener.call(thisArgs, e),
      null,
      disposables
    );
}

export function dispose(disposables: any[]): any[] {
  disposables.forEach(disposable => disposable.dispose());

  return [];
}

export function combinedDisposable(disposables: IDisposable[]): IDisposable {
  return toDisposable(() => dispose(disposables));
}

export function toDisposable(dispose: () => void): IDisposable {
  return { dispose };
}

export function onceEvent<T>(event: Event<T>): Event<T> {
  return (listener: any, thisArgs = null, disposables?: any) => {
    const result = event(
      (e: any) => {
        result.dispose();
        return listener.call(thisArgs, e);
      },
      null,
      disposables
    );

    return result;
  };
}

export function eventToPromise<T>(event: Event<T>): Promise<T> {
  return new Promise<T>(c => onceEvent(event)(c));
}

const regexNormalizePath = new RegExp(sep === "/" ? "\\\\" : "/", "g");
const regexNormalizeWindows = new RegExp("^\\\\(\\w:)", "g");
export function fixPathSeparator(file: string) {
  file = file.replace(regexNormalizePath, sep);
  file = file.replace(regexNormalizeWindows, "$1"); // "\t:\test" => "t:\test"
  return file;
}

export function isDescendant(parent: string, descendant: string): boolean {
  parent = parent.replace(/[\\\/]/g, sep);
  descendant = descendant.replace(/[\\\/]/g, sep);

  // IF Windows
  if (sep === "\\") {
    parent = parent.replace(/^\\/, "").toLowerCase();
    descendant = descendant.replace(/^\\/, "").toLowerCase();
  }

  if (parent === descendant) {
    return true;
  }

  if (parent.charAt(parent.length - 1) !== sep) {
    parent += sep;
  }

  return descendant.startsWith(parent);
}

export function camelcase(name: string) {
  return name
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
      return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
    })
    .replace(/[\s\-]+/g, "");
}

const hasDecorationProvider = false;
export function hasSupportToDecorationProvider() {
  return hasDecorationProvider;
}

const hasRegisterDiffCommand = false;
export function hasSupportToRegisterDiffCommand() {
  return hasRegisterDiffCommand;
}

export function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isReadOnly(operation: Operation): boolean {
  switch (operation) {
    case Operation.CurrentBranch:
    case Operation.Log:
    case Operation.Show:
      return true;
    default:
      return false;
  }
}
