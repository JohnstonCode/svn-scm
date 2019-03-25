/**
 * Load local first, after load the from VSCode modules
 * == 0 - is svn-scm/out/node_modules
 * == 1 - is svn-scm/node_modules
 * == 2 - is vscode folder
 * >= 3 - parent folders of svn-scm
 */
import * as vscode from "vscode";
module.paths.splice(2, 0, `${vscode.env.appRoot}/node_modules.asar`);
module.paths.splice(2, 0, `${vscode.env.appRoot}/node_modules`); // VSCode < 1.21.0

import * as cp from "child_process";
import { EventEmitter } from "events";
import * as iconv from "iconv-lite";
import isUtf8 = require("is-utf8");
import * as jschardet from "jschardet";
import * as proc from "process";
import { Readable } from "stream";
import { Uri, workspace } from "vscode";
import {
  ConstructorPolicy,
  ICpOptions,
  IExecutionResult,
  ISvnOptions
} from "./common/types";
import { configuration } from "./helpers/configuration";
import { parseInfoXml } from "./infoParser";
import SvnError from "./svnError";
import { Repository } from "./svnRepository";
import { dispose, IDisposable, toDisposable } from "./util";

export const svnErrorCodes: { [key: string]: string } = {
  AuthorizationFailed: "E170001",
  RepositoryIsLocked: "E155004",
  NotASvnRepository: "E155007",
  NotShareCommonAncestry: "E195012",
  WorkingCopyIsTooOld: "E155036"
};

function getSvnErrorCode(stderr: string): string | undefined {
  for (const name in svnErrorCodes) {
    if (svnErrorCodes.hasOwnProperty(name)) {
      const code = svnErrorCodes[name];
      const regex = new RegExp(`svn: ${code}`);
      if (regex.test(stderr)) {
        return code;
      }
    }
  }

  if (/No more credentials or we tried too many times/.test(stderr)) {
    return svnErrorCodes.AuthorizationFailed;
  }

  return void 0;
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

  public async exec(
    cwd: string,
    args: any[],
    options: ICpOptions = {}
  ): Promise<IExecutionResult> {
    if (cwd) {
      this.lastCwd = cwd;
      options.cwd = cwd;
    }

    if (options.log !== false) {
      const argsOut = args.map(arg => (/ |^$/.test(arg) ? `'${arg}'` : arg));
      this.logOutput(
        `[${this.lastCwd.split(/[\\\/]+/).pop()}]$ svn ${argsOut.join(" ")}\n`
      );
    }

    if (options.username) {
      args.push("--username", options.username);
    }
    if (options.password) {
      args.push("--password", options.password);
    }

    // Force non interactive environment
    args.push("--non-interactive");

    let encoding = options.encoding || "";
    delete options.encoding;

    const defaults: cp.SpawnOptions = {
      env: proc.env
    };
    if (cwd) {
      defaults.cwd = cwd;
    }
    const process = cp.spawn(this.svnPath, args, defaults);

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

    const [exitCode, stdout, stderr] = await Promise.all<any>([
      new Promise<number>((resolve, reject) => {
        once(process, "error", reject);
        once(process, "exit", resolve);
      }),
      new Promise<Buffer>(resolve => {
        const buffers: Buffer[] = [];
        on(process.stdout as Readable, "data", (b: Buffer) => buffers.push(b));
        once(process.stdout as Readable, "close", () =>
          resolve(Buffer.concat(buffers))
        );
      }),
      new Promise<string>(resolve => {
        const buffers: Buffer[] = [];
        on(process.stderr as Readable, "data", (b: Buffer) => buffers.push(b));
        once(process.stderr as Readable, "close", () =>
          resolve(Buffer.concat(buffers).toString())
        );
      })
    ]);

    dispose(disposables);

    // SVN with '--xml' always return 'UTF-8', and jschardet detects this encoding: 'TIS-620'
    if (args.includes("--xml")) {
      encoding = "utf8";
    } else if (encoding === "") {
      const defaultEncoding = configuration.get<string>("default.encoding");
      if (defaultEncoding) {
        if (!iconv.encodingExists(defaultEncoding)) {
          this.logOutput(
            "svn.default.encoding: Invalid Parameter: '" +
              defaultEncoding +
              "'.\n"
          );
        } else if (!isUtf8(stdout)) {
          encoding = defaultEncoding;
        }
      } else {
        jschardet.MacCyrillicModel.mTypicalPositiveRatio += 0.001;

        const encodingGuess = jschardet.detect(stdout);

        if (
          encodingGuess.confidence > 0.8 &&
          iconv.encodingExists(encodingGuess.encoding)
        ) {
          encoding = encodingGuess.encoding;
        } else if (!iconv.encodingExists(encoding)) {
          console.error(`Encoding '${encoding}' doesn't exist!`);
          encoding = "utf8";
        }
      }
    }

    const decodedStdout = iconv.decode(stdout, encoding);

    if (options.log !== false && stderr.length > 0) {
      const name = this.lastCwd.split(/[\\\/]+/).pop();
      const err = stderr
        .split("\n")
        .filter((line: string) => line)
        .map((line: string) => `[${name}]$ ${line}`)
        .join("\n");
      this.logOutput(err);
    }

    if (exitCode) {
      console.error("Err", stderr, new Error().stack);
      return Promise.reject<IExecutionResult>(
        new SvnError({
          message: "Failed to execute svn",
          stdout: decodedStdout,
          stderr,
          stderrFormated: stderr.replace(/^svn: E\d+: +/gm, ""),
          exitCode,
          svnErrorCode: getSvnErrorCode(stderr),
          svnCommand: args[0]
        })
      );
    }

    return { exitCode, stdout: decodedStdout, stderr };
  }

  public async getRepositoryRoot(path: string) {
    try {
      const result = await this.exec(path, ["info", "--xml"]);

      const info = await parseInfoXml(result.stdout);

      if (info && info.wcInfo && info.wcInfo.wcrootAbspath) {
        return info.wcInfo.wcrootAbspath;
      }

      // SVN 1.6 not has "wcroot-abspath"
      return path;
    } catch (error) {
      if (error instanceof SvnError) {
        throw error;
      }
      console.error(error);
      throw new Error("Unable to find repository root path");
    }
  }

  public async open(
    repositoryRoot: string,
    workspaceRoot: string
  ): Promise<Repository> {
    return new Repository(
      this,
      repositoryRoot,
      workspaceRoot,
      ConstructorPolicy.Async
    );
  }
}
