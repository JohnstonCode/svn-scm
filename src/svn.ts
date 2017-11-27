import { window } from "vscode";
import * as cp from "child_process";
import * as iconv from "iconv-lite";
import * as jschardet from "jschardet";
import { EventEmitter } from "events";

interface CpOptions {
  cwd?: string;
  encoding?: string;
  log?: boolean;
}

export class Svn {
  private _onOutput = new EventEmitter();
  get onOutput(): EventEmitter {
    return this._onOutput;
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

    let process = cp.spawn("svn", args, options);

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
      let result = await this.infoShowItem(path, "wc-root");
      let rootPath = result.stdout.trim();
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

  infoShowItem(path: string, item: string) {
    return this.exec(path, ["info", "--show-item", item]);
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
      const result = await this.svn.infoShowItem(this.root, "url");
      const currentBranch = result.stdout
        .trim()
        .split("/")
        .pop();
      return currentBranch;
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  async getRepoUrl() {
    const info = await this.svn.infoShowItem(this.root, "url");

    if (info.exitCode !== 0) {
      throw new Error(info.stderr);
    }

    let repoUrl = "";
    const match = info.stdout.trim().match(
      /(.*?)\/(trunk|branches|tags).*?/
    );

    if (match[1]) {
      repoUrl = match[1];
    } else {
      const infoRoot = await this.svn.infoShowItem(this.root, "repos-root-url");

      if (infoRoot.exitCode !== 0) {
        throw new Error(infoRoot.stderr);
      }

      repoUrl = infoRoot.stdout.trim();
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
