import {
  FileSystemProvider,
  Event,
  FileChangeEvent,
  EventEmitter,
  Uri,
  Disposable,
  FileStat,
  FileType,
  FileSystemError,
  FileChangeType,
  workspace
} from "vscode";
import * as path from "path";

export class File implements FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;
  name: string;
  data?: Uint8Array;

  constructor(name: string) {
    this.type = FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
}

export class Directory implements FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  entries: Map<string, File | Directory>;

  constructor(name: string) {
    this.type = FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.entries = new Map();
  }
}

export type Entry = File | Directory;

class SvnFs implements FileSystemProvider, Disposable {
  private _emitter = new EventEmitter<FileChangeEvent[]>();
  private _bufferedEvents: FileChangeEvent[] = [];
  private _fireSoonHandler?: NodeJS.Timer;
  private _root = new Directory("");
  private _disposables: Disposable[] = [];

  readonly onDidChangeFile: Event<FileChangeEvent[]> = this._emitter.event;

  constructor() {
    this._disposables.push(
      workspace.registerFileSystemProvider("svnfs", this, {
        isCaseSensitive: true
      })
    );
  }

  watch(_resource: Uri): Disposable {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => {});
  }

  stat(uri: Uri): FileStat {
    return this._lookup(uri, false);
  }

  readDirectory(uri: Uri): [string, FileType][] {
    const entry = this._lookupAsDirectory(uri, false);
    const result: [string, FileType][] = [];
    for (const [name, child] of entry.entries) {
      result.push([name, child.type]);
    }

    return result;
  }

  createDirectory(uri: Uri): void {
    const basename = path.posix.basename(uri.path);
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    const parent = this._lookupAsDirectory(dirname, false);

    const entry = new Directory(basename);
    parent.entries.set(entry.name, entry);
    parent.mtime = Date.now();
    parent.size += 1;

    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { type: FileChangeType.Created, uri }
    );
  }

  readFile(uri: Uri): Uint8Array {
    const data = this._lookupAsFile(uri, false).data;
    if (data) {
      return data;
    }

    throw FileSystemError.FileNotFound();
  }

  writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void {
    const basename = path.posix.basename(uri.path);
    const parent = this._lookupParentDirectory(uri);
    let entry = parent.entries.get(basename);
    if (entry instanceof Directory) {
      throw FileSystemError.FileIsADirectory(uri);
    }

    if (!entry && !options.create) {
      throw FileSystemError.FileNotFound(uri);
    }

    if (entry && options.create && !options.overwrite) {
      throw FileSystemError.FileExists(uri);
    }

    if (!entry) {
      entry = new File(basename);
      parent.entries.set(basename, entry);
      this._fireSoon({ type: FileChangeType.Created, uri });
    }

    entry.mtime = Date.now();
    entry.size = content.byteLength;
    entry.data = content;

    this._fireSoon({ type: FileChangeType.Changed, uri });
  }

  delete(uri: Uri): void {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    const basename = path.posix.basename(uri.path);
    const parent = this._lookupAsDirectory(dirname, false);
    if (!parent.entries.has(basename)) {
      throw FileSystemError.FileNotFound(uri);
    }
    parent.entries.delete(basename);
    parent.mtime = Date.now();
    parent.size -= 1;

    this._fireSoon(
      { type: FileChangeType.Changed, uri: dirname },
      { type: FileChangeType.Deleted, uri }
    );
  }

  rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): void {
    if (!options.overwrite && this._lookup(newUri, true)) {
      throw FileSystemError.FileExists(newUri);
    }

    const entry = this._lookup(oldUri, false);
    const oldParent = this._lookupParentDirectory(oldUri);

    const newParent = this._lookupParentDirectory(newUri);
    const newName = path.posix.basename(newUri.path);

    oldParent.entries.delete(entry.name);
    entry.name = newName;
    newParent.entries.set(newName, entry);

    this._fireSoon(
      { type: FileChangeType.Deleted, uri: oldUri },
      { type: FileChangeType.Created, uri: newUri }
    );
  }

  dispose(): void {
    this._disposables.forEach(disposable => disposable.dispose());
    this._disposables = [];

    for (const [name] of this.readDirectory(Uri.parse('svnfs:/'))) {
      this.delete(Uri.parse(`svnfs:/${name}`));
    }
  }

  private _lookup(uri: Uri, silent: false): Entry;
  private _lookup(uri: Uri, silent: boolean): Entry | undefined;
  private _lookup(uri: Uri, silent: boolean): Entry | undefined {
    const parts = uri.path.split("/");
    let entry: Entry = this._root;

    for (const part of parts) {
      if (!part) {
        continue;
      }

      let child: Entry | undefined;
      if (entry instanceof Directory) {
        child = entry.entries.get(part);
      }

      if (!child) {
        if (!silent) {
          throw FileSystemError.FileNotFound(uri);
        } else {
          return undefined;
        }
      }

      entry = child;
    }

    return entry;
  }

  private _lookupAsDirectory(uri: Uri, silent: boolean): Directory {
    const entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }

    throw FileSystemError.FileNotADirectory(uri);
  }

  private _lookupAsFile(uri: Uri, silent: boolean): File {
    const entry = this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }

    throw FileSystemError.FileIsADirectory(uri);
  }

  private _lookupParentDirectory(uri: Uri): Directory {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) });
    return this._lookupAsDirectory(dirname, false);
  }

  private _fireSoon(...events: FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);

    if (this._fireSoonHandler) {
      clearTimeout(this._fireSoonHandler);
    }

    this._fireSoonHandler = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 1);
  }
}

export const svnFs = new SvnFs();
