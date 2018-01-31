import { EventEmitter } from "events";
import { window, workspace, Uri } from "vscode";
import * as cp from "child_process";
import * as iconv from "iconv-lite";
import * as jschardet from "jschardet";
import * as path from "path";
import { Repository } from "./svnRepository";
import { parseInfoXml } from "./infoParser";

// List: https://github.com/apache/subversion/blob/1.6.x/subversion/svn/schema/status.rnc#L33
export enum Status {
  ADDED = "added",
  CONFLICTED = "conflicted",
  DELETED = "deleted",
  EXTERNAL = "external",
  IGNORED = "ignored",
  INCOMPLETE = "incomplete",
  MERGED = "merged",
  MISSING = "missing",
  MODIFIED = "modified",
  NONE = "none",
  NORMAL = "normal",
  OBSTRUCTED = "obstructed",
  REPLACED = "replaced",
  UNVERSIONED = "unversioned"
}

export enum PropStatus {
  CONFLICTED = "conflicted",
  MODIFIED = "modified",
  NONE = "none",
  NORMAL = "normal"
}

export interface CpOptions {
  cwd?: string;
  encoding?: string;
  log?: boolean;
}

export interface ISvnErrorData {
  error?: Error;
  message?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  svnErrorCode?: string;
  svnCommand?: string;
}

export interface ISvnOptions {
  svnPath: string;
  version: string;
}

export function cpErrorHandler(
  cb: (reason?: any) => void
): (reason?: any) => void {
  return err => {
    if (/ENOENT/.test(err.message)) {
      err = new SvnError({
        error: err,
        message: "Failed to execute svn (ENOENT)",
        svnErrorCode: "NotASvnRepository"
      });
    }

    cb(err);
  };
}

export class SvnError {
  error?: Error;
  message: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  svnErrorCode?: string;
  svnCommand?: string;

  constructor(data: ISvnErrorData) {
    if (data.error) {
      this.error = data.error;
      this.message = data.error.message;
    } else {
      this.error = void 0;
    }

    this.message = this.message || data.message || "SVN error";
    this.stdout = data.stdout;
    this.stderr = data.stderr;
    this.exitCode = data.exitCode;
    this.svnErrorCode = data.svnErrorCode;
    this.svnCommand = data.svnCommand;
  }

  toString(): string {
    let result =
      this.message +
      " " +
      JSON.stringify(
        {
          exitCode: this.exitCode,
          svnErrorCode: this.svnErrorCode,
          svnCommand: this.svnCommand,
          stdout: this.stdout,
          stderr: this.stderr
        },
        null,
        2
      );

    if (this.error) {
      result += (<any>this.error).stack;
    }

    return result;
  }
}

export class Svn {
  private svnPath: string;
  private version: string;
  private lastCwd: string = "";

  private _onOutput = new EventEmitter();
  get onOutput(): EventEmitter {
    return this._onOutput;
  }

  constructor(options: ISvnOptions) {
    this.svnPath = options.svnPath;
    this.version = options.version;
  }

  private logOutput(output: string): void {
    this._onOutput.emit("log", output);
  }

  async exec(cwd: string, args: any[], options: CpOptions = {}) {
    if (cwd) {
      this.lastCwd = cwd;
      options.cwd = cwd;
    }

    if (options.log !== false) {
      this.logOutput(
        `[${this.lastCwd.split(/[\\\/]+/).pop()}]$ svn ${args.join(" ")}\n`
      );
    }

    let process = cp.spawn(this.svnPath, args, options);

    let [exitCode, stdout, stderr] = await Promise.all<any>([
      new Promise<number>((resolve, reject) => {
        process.once("error", reject);
        process.once("exit", resolve);
      }),
      new Promise<Buffer>(resolve => {
        const buffers: Buffer[] = [];
        process.stdout.on("data", (b: Buffer) => buffers.push(b));
        process.stdout.once("close", () => resolve(Buffer.concat(buffers)));
      }),
      new Promise<string>(resolve => {
        const buffers: Buffer[] = [];
        process.stderr.on("data", (b: Buffer) => buffers.push(b));
        process.stderr.once("close", () =>
          resolve(Buffer.concat(buffers).toString())
        );
      })
    ]);

    jschardet.MacCyrillicModel.mTypicalPositiveRatio += 0.001;

    const encodingGuess = jschardet.detect(stdout);

    const encoding =
      encodingGuess.confidence > 0.8 ? encodingGuess.encoding : "utf8";

    stdout = iconv.decode(stdout, encoding);

    if (options.log !== false && stderr.length > 0) {
      this.logOutput(`${stderr}\n`);
    }

    return { exitCode, stdout, stderr };
  }

  async getRepositoryRoot(path: string) {
    try {
      const result = await this.exec(path, ["info", "--xml"]);

      const info = await parseInfoXml(result.stdout);
      return info.wcInfo.wcrootAbspath;
    } catch (error) {
      console.error(error);
      throw new Error("Unable to find repository root path");
    }
  }

  open(repositoryRoot: string, workspaceRoot: string): Repository {
    return new Repository(this, repositoryRoot, workspaceRoot);
  }

  add(path: string) {
    path = path.replace(/\\/g, "/");
    return this.exec("", ["add", path]);
  }

  addChangelist(path: string, changelist: string) {
    path = path.replace(/\\/g, "/");
    return this.exec("", ["changelist", changelist, path]);
  }

  removeChangelist(path: string) {
    path = path.replace(/\\/g, "/");
    return this.exec("", ["changelist", path, "--remove"]);
  }

  show(path: string, revision?: string, options: CpOptions = {}) {
    const args = ["cat", path];

    if (revision) {
      args.push("-r", revision);
    }

    return this.exec("", args, options);
  }

  list(path: string) {
    return this.exec("", ["ls", path]);
  }

  commit(message: string, files: any[]) {
    let args = ["commit", "-m", message];

    for (let file of files) {
      args.push(file);
    }

    return this.exec("", args);
  }

  ls(filePath: string) {
    return this.exec("", ["ls", "--xml", filePath]);
  }

  info(path: string) {
    return this.exec(path, ["info", "--xml"]);
  }

  copy(rootPath: string, branchPath: string, name: string) {
    return this.exec("", [
      "copy",
      rootPath,
      branchPath,
      "-m",
      `Created new branch ${name}`
    ]);
  }

  checkout(root: string, branchPath: string) {
    return this.exec(root, ["checkout", branchPath]);
  }

  switchBranch(root: string, path: string) {
    return this.exec(root, ["switch", path]);
  }

  revert(files: any[]) {
    let args = ["revert"];

    for (let file of files) {
      if (file instanceof Uri) {
        args.push(file.fsPath);
      } else {
        args.push(file);
      }
    }

    return this.exec("", args);
  }

  update(root: string) {
    return this.exec(root, ["update"]);
  }

  patch(root: string) {
    return this.exec(root, ["diff"]);
  }

  remove(files: any[], keepLocal: boolean) {
    let args = ["remove"];

    if (keepLocal) {
      args.push("--keep-local");
    }

    for (let file of files) {
      if (file instanceof Uri) {
        args.push(file.fsPath);
      } else {
        args.push(file);
      }
    }

    return this.exec("", args);
  }

  resolve(file: string, action: string) {
    return this.exec("", ["resolve", "--accept", action, file]);
  }

  log(rootPath: string, length: string) {
    return this.exec(rootPath, ["log", "--limit", length]);
  }
}
