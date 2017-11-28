import { EventEmitter } from "events";
import { window } from "vscode";
import * as cp from "child_process";
import * as iconv from "iconv-lite";
import * as jschardet from "jschardet";
import * as path from 'path';

interface CpOptions {
  cwd?: string;
  encoding?: string;
  log?: boolean;
}

export interface ISvn {
  path: string;
  version: string;
}

function parseVersion(raw: string): string {
  const match = raw.match(/(\d+\.\d+\.\d+ \(r\d+\))/);

  if(match && match[0]) {
    return match[0];
  }
  return raw.split(/[\r\n]+/)[0];
}

function findSpecificSvn(path: string): Promise<ISvn> {
  return new Promise<ISvn>((c, e) => {
    const buffers: Buffer[] = [];
    const child = cp.spawn(path, ['--version']);
    child.stdout.on('data', (b: Buffer) => buffers.push(b));
    child.on('error', cpErrorHandler(e));
    child.on('exit', code => code ? e(new Error('Not found')) : c({ path, version: parseVersion(Buffer.concat(buffers).toString('utf8').trim()) }));
  });
}

function findSvnDarwin(): Promise<ISvn> {
  return new Promise<ISvn>((c, e) => {
    cp.exec('which svn', (err, svnPathBuffer) => {
      if (err) {
        return e('svn not found');
      }

      const path = svnPathBuffer.toString().replace(/^\s+|\s+$/g, '');

      function getVersion(path: string) {
        // make sure svn executes
        cp.exec('svn --version', (err, stdout) => {
          if (err) {
            return e('svn not found');
          }

          return c({ path, version: parseVersion(stdout.trim()) });
        });
      }

      if (path !== '/usr/bin/svn') {
        return getVersion(path);
      }

      // must check if XCode is installed
      cp.exec('xcode-select -p', (err: any) => {
        if (err && err.code === 2) {
          // svn is not installed, and launching /usr/bin/svn
          // will prompt the user to install it

          return e('svn not found');
        }

        getVersion(path);
      });
    });
  });
}

function findSystemSvnWin32(base: string): Promise<ISvn> {
  if (!base) {
    return Promise.reject<ISvn>('Not found');
  }

  return findSpecificSvn(path.join(base, 'TortoiseSVN', 'bin', 'svn.exe'));
}

function findSvnWin32(): Promise<ISvn> {
  return findSystemSvnWin32(process.env['ProgramW6432'])
    .then(void 0, () => findSystemSvnWin32(process.env['ProgramFiles(x86)']))
    .then(void 0, () => findSystemSvnWin32(process.env['ProgramFiles']))
    .then(void 0, () => findSpecificSvn('svn'));
}

export function findSvn(hint: string | undefined): Promise<ISvn> {
  var first = hint ? findSpecificSvn(hint) : Promise.reject<ISvn>(null);

  return first
    .then(void 0, () => {
      switch (process.platform) {
        case 'darwin': return findSvnDarwin();
        case 'win32': return findSvnWin32();
        default: return findSpecificSvn('svn');
      }
    })
    .then(null, () => Promise.reject(new Error('Svn installation not found.')));
}

function cpErrorHandler(cb: (reason?: any) => void): (reason?: any) => void {
  return err => {
    if (/ENOENT/.test(err.message)) {
      err = new SvnError({
        error: err,
        message: 'Failed to execute svn (ENOENT)',
        svnErrorCode: 'NotASvnRepository'
      });
    }

    cb(err);
  };
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

    this.message = this.message || data.message || 'SVN error';
    this.stdout = data.stdout;
    this.stderr = data.stderr;
    this.exitCode = data.exitCode;
    this.svnErrorCode = data.svnErrorCode;
    this.svnCommand = data.svnCommand;
  }

  toString(): string {
    let result = this.message + ' ' + JSON.stringify({
      exitCode: this.exitCode,
      svnErrorCode: this.svnErrorCode,
      svnCommand: this.svnCommand,
      stdout: this.stdout,
      stderr: this.stderr
    }, null, 2);

    if (this.error) {
      result += (<any>this.error).stack;
    }

    return result;
  }
}

export interface ISvnOptions {
  svnPath: string;
  version: string;
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

  public async isSvnAvailable() {
    return new Promise((resolve, reject) => {
      cp.exec("svn --version", (error, stdout, stderr) => {
        if (error) {
          console.log(stderr);
          window.showErrorMessage(stderr);
          reject();
        }

        resolve();
      });
    });
  }

  open(repositoryRoot: string, workspaceRoot: string): Repository {
    return new Repository(this, repositoryRoot, workspaceRoot);
  }

  add(path: string) {
    path = path.replace(/\\/g, "/");
    return this.exec("", ["add", path]);
  }

  show(path: string, options: CpOptions = {}) {
    return this.exec("", ["cat", "-r", "HEAD", path], options);
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
}

export class Repository {
  constructor(
    private svn: Svn,
    public root: string,
    public workspaceRoot: string
  ) {}

  async getStatus(): Promise<any[]> {
    const result = await this.svn.exec(this.workspaceRoot, ["stat"]);

    let items = result.stdout.split("\n");
    let status = [];

    for (let item of items) {
      let state = item.charAt(0);
      let path = item.substr(8).trim();

      status.push([state, path]);
    }

    return status;
  }

  async show(path: string, options: CpOptions = {}): Promise<string> {
    const result = await this.svn.show(path, options);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    return result.stdout;
  }

  async commitFiles(message: string, files: any[]) {
    const result = await this.svn.commit(message, files);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    return result.stdout;
  }

  addFile(filePath: string) {
    return this.svn.add(filePath);
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const result = await this.svn.info(this.root);
      const currentBranch = result.stdout
        .match(/<url>(.*?)<\/url>/)[1]
        .split("/")
        .pop();
      return currentBranch;
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  async getRepoUrl() {
    const info = await this.svn.info(this.root);

    if (info.exitCode !== 0) {
      throw new Error(info.stderr);
    }

    let repoUrl = info.stdout.match(/<root>(.*?)<\/root>/)[1];
    const match = info.stdout.match(
      /<url>(.*?)\/(trunk|branches|tags).*?<\/url>/
    );

    if (match && match[1]) {
      repoUrl = match[1];
    }

    return repoUrl;
  }

  async getBranches() {
    const repoUrl = await this.getRepoUrl();

    const branches = [];

    let trunkExists = await this.svn.exec("", [
      "ls",
      repoUrl + "/trunk",
      "--depth",
      "empty"
    ]);

    if (trunkExists.exitCode === 0) {
      branches.push("trunk");
    }

    const trees = ["branches", "tags"];

    for (let index in trees) {
      const tree = trees[index];
      const branchUrl = repoUrl + "/" + tree;

      const result = await this.svn.list(branchUrl);

      if (result.exitCode !== 0) {
        continue;
      }

      const list = result.stdout
        .trim()
        .replace(/\/|\\/g, "")
        .split(/[\r\n]+/)
        .map((i: string) => tree + "/" + i);

      branches.push(...list);
    }

    return branches;
  }

  async branch(name: string) {
    const repoUrl = await this.getRepoUrl();
    const newBranch = repoUrl + "/branches/" + name;
    const rootUrl = repoUrl + "/trunk";

    const result = await this.svn.copy(rootUrl, newBranch, name);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    const switchBranch = await this.svn.switchBranch(this.root, newBranch);

    if (switchBranch.exitCode !== 0) {
      throw new Error(switchBranch.stderr);
    }

    return true;
  }

  async switchBranch(ref: string) {
    const repoUrl = await this.getRepoUrl();

    var branchUrl = repoUrl + "/" + ref;

    const switchBranch = await this.svn.switchBranch(this.root, branchUrl);

    if (switchBranch.exitCode !== 0) {
      throw new Error(switchBranch.stderr);
    }

    return true;
  }

  async revert(files: any[]) {
    const result = await this.svn.revert(files);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    return result.stdout;
  }
}
