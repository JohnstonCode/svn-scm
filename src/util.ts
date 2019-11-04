import * as path from "path";
import { Event, commands } from "vscode";
import { Operation } from "./common/types";
import { exists, lstat, readdir, rmdir, unlink } from "./fs";

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

const regexNormalizePath = new RegExp(path.sep === "/" ? "\\\\" : "/", "g");
const regexNormalizeWindows = new RegExp("^\\\\(\\w:)", "g");
export function fixPathSeparator(file: string) {
  file = file.replace(regexNormalizePath, path.sep);
  file = file.replace(regexNormalizeWindows, "$1"); // "\t:\test" => "t:\test"
  return file;
}

export function normalizePath(file: string) {
  file = fixPathSeparator(file);

  // IF Windows
  if (path.sep === "\\") {
    file = file.toLowerCase();
  }

  return file;
}

export function isDescendant(parent: string, descendant: string): boolean {
  parent = parent.replace(/[\\\/]/g, path.sep);
  descendant = descendant.replace(/[\\\/]/g, path.sep);

  // IF Windows
  if (path.sep === "\\") {
    parent = parent.replace(/^\\/, "").toLowerCase();
    descendant = descendant.replace(/^\\/, "").toLowerCase();
  }

  if (parent === descendant) {
    return true;
  }

  if (parent.charAt(parent.length - 1) !== path.sep) {
    parent += path.sep;
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

let hasRegisterDiffCommand = false;
export function hasSupportToRegisterDiffCommand() {
  return hasRegisterDiffCommand;
}

try {
  const disposable = (commands as any).registerDiffInformationCommand(
    "svn.testDiff",
    () => {}
  );
  hasRegisterDiffCommand = true;
  disposable.dispose();
} catch (error) {}

export function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isReadOnly(operation: Operation): boolean {
  switch (operation) {
    case Operation.CurrentBranch:
    case Operation.Log:
    case Operation.Show:
    case Operation.Info:
      return true;
    default:
      return false;
  }
}

/**
 * Remove directory recursively
 * @param {string} dirPath
 * @see https://stackoverflow.com/a/42505874/3027390
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
  if ((await exists(dirPath)) && (await lstat(dirPath)).isDirectory()) {
    await Promise.all((await readdir(dirPath)).map(async (entry: string) => {
      const entryPath = path.join(dirPath, entry);
      if ((await lstat(entryPath)).isDirectory()) {
        await deleteDirectory(entryPath);
      } else {
        await unlink(entryPath);
      }
    }));
    await rmdir(dirPath);
  }
}

export function unwrap<T>(maybeT?: T): T {
  if (maybeT === undefined) {
    throw new Error("undefined unwrap");
  }
  return maybeT;
}

export function fixPegRevision(file: string) {
  // Fix Peg Revision Algorithm (http://svnbook.red-bean.com/en/1.8/svn.advanced.pegrevs.html)
  if (/@/.test(file)) {
    file += "@";
  }

  return file;
}

export async function isSvnFolder(dir: string, checkParent: boolean = true): Promise<boolean> {

  const result = await exists(`${dir}/.svn`);

  if (result || !checkParent) {
    return result;
  }

  const parent = path.dirname(dir);

  // For windows: the `path.dirname("c:")` return `c:`
  // For empty or doted dir, return "."
  if (parent === dir || parent === ".") {
    return false;
  }

  return await isSvnFolder(parent, true);
}
