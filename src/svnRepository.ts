import { workspace, Uri } from "vscode";
import { Svn, CpOptions, IExecutionResult } from "./svn";
import { IFileStatus, parseStatusXml } from "./statusParser";
import { parseInfoXml, ISvnInfo } from "./infoParser";
import { sequentialize } from "./decorators";
import * as path from "path";
import { fixPathSeparator } from "./util";

export class Repository {
  private _info?: ISvnInfo;

  public username?: string;
  public password?: string;

  constructor(
    private svn: Svn,
    public root: string,
    public workspaceRoot: string
  ) { }

  async exec(
    args: string[],
    options: CpOptions = {}
  ): Promise<IExecutionResult> {
    options.username = this.username;
    options.password = this.password;

    return await this.svn.exec(this.workspaceRoot, args, options);
  }

  removeAbsolutePath(file: string) {
    file = fixPathSeparator(file);

    return path.relative(this.workspaceRoot, file);
  }

  async getStatus(includeIgnored: boolean = false): Promise<IFileStatus[]> {
    let args = ["stat", "--xml"];

    if (includeIgnored) {
      args.push("--no-ignore");
    }

    const result = await this.exec(args);

    return await parseStatusXml(result.stdout);
  }

  resetInfo() {
    this._info = undefined;
  }

  @sequentialize
  async getInfo(): Promise<ISvnInfo> {
    if (this._info) {
      return this._info;
    }
    const result = await this.exec(["info", "--xml"]);

    this._info = await parseInfoXml(result.stdout);

    // Cache for 30 seconds
    setTimeout(() => {
      this.resetInfo();
    }, 30000);

    return this._info;
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

    const result = await this.exec(["commit", "-m", message, ...files]);

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

    const config = workspace.getConfiguration("svn");
    const trunkLayout = config.get<string>("layout.trunk");
    const branchesLayout = config.get<string>("layout.branches");
    const tagsLayout = config.get<string>("layout.tags");

    const trees = [trunkLayout, branchesLayout, tagsLayout].filter(
      x => x != null
    );
    const regex = new RegExp("(.*?)/(" + trees.join("|") + ")(/([^/]+))?.*?");

    const match = info.url.match(regex);

    if (match) {
      if (match[4] && match[2] !== trunkLayout) {
        return match[4];
      }
      if (match[2]) {
        return match[2];
      }
    }

    return "";
  }

  async getRepoUrl() {
    const config = workspace.getConfiguration("svn");
    const trunkLayout = config.get<string>("layout.trunk");
    const branchesLayout = config.get<string>("layout.branches");
    const tagsLayout = config.get<string>("layout.tags");

    const trees = [trunkLayout, branchesLayout, tagsLayout].filter(
      x => x != null
    );
    const regex = new RegExp("(.*?)/(" + trees.join("|") + ").*?");

    const info = await this.getInfo();

    let repoUrl = info.repository.root;
    const match = info.url.match(regex);

    if (match && match[1]) {
      repoUrl = match[1];
    }

    return repoUrl;
  }

  async getBranches() {
    const config = workspace.getConfiguration("svn");
    const trunkLayout = config.get<string>("layout.trunk");
    const branchesLayout = config.get<string>("layout.branches");
    const tagsLayout = config.get<string>("layout.tags");

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
    const config = workspace.getConfiguration("svn");
    const branchesLayout = config.get<string>("layout.branches");

    if (!branchesLayout) {
      return false;
    }

    const repoUrl = await this.getRepoUrl();
    const newBranch = repoUrl + "/" + branchesLayout + "/" + name;
    const info = await this.getInfo();
    const currentBranch = info.url;
    const result = await this.exec([
      "copy",
      currentBranch,
      newBranch,
      "-m",
      `Created new branch ${name}`
    ]);

    const switchBranch = await this.exec(["switch", newBranch]);

    this.resetInfo();

    return true;
  }

  async switchBranch(ref: string) {
    const repoUrl = await this.getRepoUrl();

    const branchUrl = repoUrl + "/" + ref;

    const switchBranch = await this.exec(["switch", branchUrl]);

    this.resetInfo();

    return true;
  }

  async revert(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.exec(["revert", ...files]);
    return result.stdout;
  }

  async update(): Promise<string> {
    const result = await this.exec(["update"]);

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

  async patch() {
    const result = await this.exec(["diff"]);

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

  async resolve(file: string, action: string) {
    file = this.removeAbsolutePath(file);

    const result = await this.exec(["resolve", "--accept", action, file]);

    return result.stdout;
  }

  async log() {
    const config = workspace.getConfiguration("svn");
    const logLength = config.get<string>("log.length") || "50";
    const result = await this.exec(["log", "--limit", logLength]);

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
}
