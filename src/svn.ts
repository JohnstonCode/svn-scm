import { EventEmitter } from "events";
import { window, workspace, Uri } from "vscode";
import * as cp from "child_process";
import * as iconv from "iconv-lite";
import * as jschardet from "jschardet";
import * as path from "path";
import { Repository } from "./svnRepository";
import { parseInfoXml } from "./infoParser";
import { SpawnOptions } from "child_process";
import { IDisposable, toDisposable, dispose } from "./util";

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

export const SvnErrorCodes: { [key: string]: string } = {
  AuthorizationFailed: "E170001",
  RepositoryIsLocked: "E155004",
  NotASvnRepository: "E155007",
  NotShareCommonAncestry: "E195012"
};

function getSvnErrorCode(stderr: string): string | undefined {
  for (const name in SvnErrorCodes) {
    const code = SvnErrorCodes[name];
    const regex = new RegExp(`svn: ${code}`);
    if (regex.test(stderr)) {
      return code;
    }
  }

  if (/No more credentials or we tried too many times/.test(stderr)) {
    return SvnErrorCodes.AuthorizationFailed;
  }

  return void 0;
}

export interface CpOptions extends SpawnOptions {
  cwd?: string;
  encoding?: string;
  log?: boolean;
  username?: string;
  password?: string;
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

export interface IExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
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

  async exec(
    cwd: string,
    args: any[],
    options: CpOptions = {}
  ): Promise<IExecutionResult> {
    if (cwd) {
      this.lastCwd = cwd;
      options.cwd = cwd;
    }

    if (options.log !== false) {
      this.logOutput(
        `[${this.lastCwd.split(/[\\\/]+/).pop()}]$ svn ${args.join(" ")}\n`
      );
    }

    if (options.username) {
      args.push("--username", options.username);
    }
    if (options.password) {
      args.push("--password", options.password);
    }

    let process = cp.spawn(this.svnPath, args, options);

    const disposables: IDisposable[] = [];

    const once = (
      ee: NodeJS.EventEmitter,
      name: string,
      fn: (...args: any[]) => void
    ) => {
      ee.once(name, fn);
      disposables.push(toDisposable(() => ee.removeListener(name, fn)));
    };

    const on = (
      ee: NodeJS.EventEmitter,
      name: string,
      fn: (...args: any[]) => void
    ) => {
      ee.on(name, fn);
      disposables.push(toDisposable(() => ee.removeListener(name, fn)));
    };

    let [exitCode, stdout, stderr] = await Promise.all<any>([
      new Promise<number>((resolve, reject) => {
        once(process, "error", reject);
        once(process, "exit", resolve);
      }),
      new Promise<Buffer>(resolve => {
        const buffers: Buffer[] = [];
        on(process.stdout, "data", (b: Buffer) => buffers.push(b));
        once(process.stdout, "close", () => resolve(Buffer.concat(buffers)));
      }),
      new Promise<string>(resolve => {
        const buffers: Buffer[] = [];
        on(process.stderr, "data", (b: Buffer) => buffers.push(b));
        once(process.stderr, "close", () =>
          resolve(Buffer.concat(buffers).toString())
        );
      })
    ]);

    dispose(disposables);

    let encoding = "utf8";

    // SVN with '--xml' always return 'UTF-8', and jschardet detects this encoding: 'TIS-620'
    if (!args.includes("--xml")) {
      jschardet.MacCyrillicModel.mTypicalPositiveRatio += 0.001;

      const encodingGuess = jschardet.detect(stdout);

      if (
        encodingGuess.confidence > 0.8 &&
        iconv.encodingExists(encodingGuess.encoding)
      ) {
        encoding = encodingGuess.encoding;
      }
    }

    stdout = iconv.decode(stdout, encoding);

    if (options.log !== false && stderr.length > 0) {
      this.logOutput(`${stderr}\n`);
    }

    if (exitCode) {
      return Promise.reject<IExecutionResult>(
        new SvnError({
          message: "Failed to execute svn",
          stdout: stdout,
          stderr: stderr,
          exitCode: exitCode,
          svnErrorCode: getSvnErrorCode(stderr),
          svnCommand: args[0]
        })
      );
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
}
