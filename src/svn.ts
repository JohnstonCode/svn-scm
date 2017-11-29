import { EventEmitter } from "events";
import { window, workspace } from "vscode";
import * as cp from "child_process";
import * as iconv from "iconv-lite";
import * as jschardet from "jschardet";
import * as path from "path";
import { Repository } from "./svnRepository";

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

  private _onOutput = new EventEmitter();
  get onOutput(): EventEmitter {
    return this._onOutput;
  }

  constructor(options: ISvnOptions) {
    this.svnPath = options.svnPath;
    this.version = options.version;
  }

  private log(output: string): void {
    this._onOutput.emit("log", output);
  }

  async exec(cwd: string, args: any[], options: CpOptions = {}) {
    if (cwd) {
      options.cwd = cwd;
    }

    if (options.log !== false) {
      this.log(`svn ${args.join(" ")}\n`);
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

    const encodingGuess = jschardet.detect(stdout);
    const encoding = iconv.encodingExists(encodingGuess.encoding)
      ? encodingGuess.encoding
      : "utf8";

    stdout = iconv.decode(stdout, encoding);

    if (options.log !== false && stderr.length > 0) {
      this.log(`${stderr}\n`);
    }

    return { exitCode, stdout, stderr };
  }

  async getRepositoryRoot(path: string) {
    try {
      let result = await this.exec(path, ["info", "--xml"]);
      let rootPath = result.stdout.match(
        /<wcroot-abspath>(.*)<\/wcroot-abspath>/i
      )[1];
      return rootPath;
    } catch (error) {
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

  show(path: string, revision?: string, options: CpOptions = {}) {
    var args = ["cat", path];

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
      args.push(file);
    }

    return this.exec("", args);
  }

  update(root: string) {
    return this.exec(root, ["update"]);
  }
}
