import { workspace, Uri } from "vscode";
import { Svn, CpOptions, IExecutionResult, Status } from "./svn";
import { IFileStatus, parseStatusXml } from "./statusParser";
import { parseInfoXml, ISvnInfo } from "./infoParser";
import { sequentialize } from "./decorators";
import * as path from "path";
import * as fs from "fs";
import { fixPathSeparator } from "./util";
import { configuration } from "./helpers/configuration";
import { parseSvnList } from "./listParser";
import { getBranchName } from "./branches";

export class Repository {
  private _info: { [index: string]: ISvnInfo } = {};

  public username?: string;
  public password?: string;

  constructor(
    private svn: Svn,
    public root: string,
    public workspaceRoot: string
  ) {}

  async exec(
    args: string[],
    options: CpOptions = {}
  ): Promise<IExecutionResult> {
    options.username = this.username;
    options.password = this.password;

    return this.svn.exec(this.workspaceRoot, args, options);
  }

  removeAbsolutePath(file: string) {
    file = fixPathSeparator(file);

    file = path.relative(this.workspaceRoot, file);

    // Fix Peg Revision Algorithm (http://svnbook.red-bean.com/en/1.8/svn.advanced.pegrevs.html)
    if (/@/.test(file)) {
      file += "@";
    }

    return file;
  }

  async getStatus(
    includeIgnored: boolean = false,
    includeExternals: boolean = true
  ): Promise<IFileStatus[]> {
    let args = ["stat", "--xml"];

    if (includeIgnored) {
      args.push("--no-ignore");
    }
    if (!includeExternals) {
      args.push("--ignore-externals");
    }

    const result = await this.exec(args);

    const status: IFileStatus[] = await parseStatusXml(result.stdout);

    for (const s of status) {
      if (s.status === Status.EXTERNAL) {
        try {
          const info = await this.getInfo(s.path);
          s.repositoryUuid = info.repository.uuid;
        } catch (error) {}
      }
    }

    return status;
  }

  resetInfo(file: string = "") {
    delete this._info[file];
  }

  @sequentialize
  async getInfo(file: string = ""): Promise<ISvnInfo> {
    if (this._info[file]) {
      return this._info[file];
    }

    const args = ["info", "--xml"];

    if (file) {
      file = fixPathSeparator(file);
      args.push(file);
    }

    const result = await this.exec(args);

    this._info[file] = await parseInfoXml(result.stdout);

    // Cache for 2 minutes
    setTimeout(() => {
      this.resetInfo(file);
    }, 2 * 60 * 1000);

    return this._info[file];
  }

  async show(
    file: string,
    revision?: string,
    options: CpOptions = {}
  ): Promise<string> {
    file = this.removeAbsolutePath(file);
    const args = ["cat", file];

    if (revision) {
      args.push("-r", revision);
    }

    const result = await this.exec(args);

    return result.stdout;
  }

  async commitFiles(message: string, files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));

    const args = ["commit", ...files];

    if (fs.existsSync(path.join(this.workspaceRoot, message))) {
      args.push("--force-log");
    }
    args.push("-m", message);

    const result = await this.exec(args);

    const matches = result.stdout.match(/Committed revision (.*)\./i);
    if (matches && matches[0]) {
      return matches[0];
    }

    return result.stdout;
  }

  addFiles(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["add", ...files]);
  }

  addChangelist(files: string[], changelist: string) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["changelist", changelist, ...files]);
  }

  removeChangelist(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["changelist", "--remove", ...files]);
  }

  async getCurrentBranch(): Promise<string> {
    const info = await this.getInfo();

    const branch = getBranchName(info.url);

    if (branch) {
      const showFullName = configuration.get<boolean>("layout.showFullName");
      if (showFullName) {
        return branch.path;
      } else {
        return branch.name;
      }
    }

    return "";
  }

  async getRepositoryUuid(): Promise<string> {
    const info = await this.getInfo();

    return info.repository.uuid;
  }

  async getRepoUrl() {
    const info = await this.getInfo();

    const branch = getBranchName(info.url);

    if (!branch) {
      return info.repository.root;
    }

    return info.url.replace(branch.path, "").replace(/\/$/, "");
  }

  async getBranches() {
    const trunkLayout = configuration.get<string>("layout.trunk");
    const branchesLayout = configuration.get<string>("layout.branches");
    const tagsLayout = configuration.get<string>("layout.tags");

    const repoUrl = await this.getRepoUrl();

    let branches: string[] = [];

    let promises = [];

    if (trunkLayout) {
      promises.push(
        new Promise<string[]>(async resolve => {
          try {
            let trunkExists = await this.exec([
              "ls",
              repoUrl + "/" + trunkLayout,
              "--depth",
              "empty"
            ]);

            resolve([trunkLayout]);
          } catch (error) {
            resolve([]);
          }
        })
      );
    }

    let trees: string[] = [];

    if (branchesLayout) {
      trees.push(branchesLayout);
    }

    if (tagsLayout) {
      trees.push(tagsLayout);
    }

    for (const tree of trees) {
      promises.push(
        new Promise<string[]>(async resolve => {
          const branchUrl = repoUrl + "/" + tree;

          try {
            const result = await this.exec(["ls", branchUrl]);

            const list = result.stdout
              .trim()
              .replace(/\/|\\/g, "")
              .split(/[\r\n]+/)
              .filter((x: string) => !!x)
              .map((i: string) => tree + "/" + i);

            resolve(list);
          } catch (error) {
            resolve([]);
          }
        })
      );
    }

    const all = await Promise.all<any>(promises);
    all.forEach(list => {
      branches.push(...list);
    });

    return branches;
  }

  async branch(name: string) {
    const repoUrl = await this.getRepoUrl();
    const newBranch = repoUrl + "/" + name;
    const info = await this.getInfo();
    const currentBranch = info.url;
    const result = await this.exec([
      "copy",
      currentBranch,
      newBranch,
      "-m",
      `Created new branch ${name}`
    ]);

    await this.switchBranch(name);

    return true;
  }

  async switchBranch(ref: string) {
    const repoUrl = await this.getRepoUrl();

    const branchUrl = repoUrl + "/" + ref;

    try {
      await this.exec(["switch", branchUrl]);
    } catch (error) {
      await this.exec(["switch", branchUrl, "--ignore-ancestry"]);
    }

    this.resetInfo();

    return true;
  }

  async revert(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.exec(["revert", ...files]);
    return result.stdout;
  }

  async update(ignoreExternals: boolean = true): Promise<string> {
    const args = ["update"];

    if (ignoreExternals) {
      args.push("--ignore-externals");
    }

    const result = await this.exec(args);

    this.resetInfo();

    const message = result.stdout
      .trim()
      .split(/\r?\n/)
      .pop();

    if (message) {
      return message;
    }
    return result.stdout;
  }

  async patch(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.exec(["diff", ...files]);
    const message = result.stdout;
    return message;
  }

  async patchChangelist(changelistName: string) {
    const result = await this.exec(["diff", "--changelist", changelistName]);
    const message = result.stdout;
    return message;
  }

  async removeFiles(files: any[], keepLocal: boolean) {
    files = files.map(file => this.removeAbsolutePath(file));
    const args = ["remove"];

    if (keepLocal) {
      args.push("--keep-local");
    }

    args.push(...files);

    const result = await this.exec(args);

    return result.stdout;
  }

  async resolve(files: string[], action: string) {
    files = files.map(file => this.removeAbsolutePath(file));

    const result = await this.exec(["resolve", "--accept", action, ...files]);

    return result.stdout;
  }

  async log() {
    const logLength = configuration.get<string>("log.length") || "50";
    const result = await this.exec([
      "log",
      "-r",
      "HEAD:1",
      "--limit",
      logLength
    ]);

    return result.stdout;
  }

  async countNewCommit(revision: string = "BASE:HEAD") {
    const result = await this.exec(["log", "-r", revision, "-q", "--xml"]);

    const matches = result.stdout.match(/<logentry/g);

    if (matches && matches.length > 0) {
      // Every return current commit
      return matches.length - 1;
    }

    return 0;
  }

  async cleanup() {
    const result = await this.exec(["cleanup"]);

    return result.stdout;
  }

  async finishCheckout() {
    const info = await this.getInfo();

    const result = await this.exec(["switch", info.url]);

    return result.stdout;
  }

  async list(folder?: string) {
    let url = await this.getRepoUrl();

    if (folder) {
      url += "/" + folder;
    }

    const result = await this.exec(["list", url, "--xml"]);

    return parseSvnList(result.stdout);
  }

  async getCurrentIgnore(directory: string) {
    directory = this.removeAbsolutePath(directory);

    let currentIgnore = "";

    try {
      const args = ["propget", "svn:ignore"];

      if (directory) {
        args.push(directory);
      }

      const currentIgnoreResult = await this.exec(args);

      currentIgnore = currentIgnoreResult.stdout.trim();
    } catch (error) {}

    const ignores = currentIgnore.split(/[\r\n]+/);

    return ignores;
  }

  async addToIgnore(
    expressions: string[],
    directory: string,
    recursive: boolean = false
  ) {
    const ignores = await this.getCurrentIgnore(directory);

    directory = this.removeAbsolutePath(directory);

    ignores.push(...expressions);
    const newIgnore = [...new Set(ignores)]
      .filter(v => !!v)
      .sort()
      .join("\n");

    const args = ["propset", "svn:ignore", newIgnore];

    if (directory) {
      args.push(directory);
    } else {
      args.push(".");
    }
    if (recursive) {
      args.push("--recursive");
    }

    const result = await this.exec(args);

    return result.stdout;
  }

  async rename(oldName: string, newName: string): Promise<string> {
    oldName = this.removeAbsolutePath(oldName);
    newName = this.removeAbsolutePath(newName);
    const args = ["rename", oldName, newName];

    const result = await this.exec(args);

    return result.stdout;
  }
}
