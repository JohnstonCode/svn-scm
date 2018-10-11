import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import { Uri, window, workspace } from "vscode";
import {
  ICpOptions,
  IExecutionResult,
  IFileStatus,
  ISvnInfo,
  Status
} from "./common/types";
import { sequentialize } from "./decorators";
import { getBranchName } from "./helpers/branch";
import { configuration } from "./helpers/configuration";
import { parseInfoXml } from "./infoParser";
import { parseSvnList } from "./listParser";
import { parseStatusXml } from "./statusParser";
import { Svn } from "./svn";
import { fixPathSeparator } from "./util";

export class Repository {
  private _info: { [index: string]: ISvnInfo } = {};

  public username?: string;
  public password?: string;

  constructor(
    private svn: Svn,
    public root: string,
    public workspaceRoot: string
  ) {}

  public async exec(
    args: string[],
    options: ICpOptions = {}
  ): Promise<IExecutionResult> {
    options.username = this.username;
    options.password = this.password;

    return this.svn.exec(this.workspaceRoot, args, options);
  }

  public removeAbsolutePath(file: string) {
    file = fixPathSeparator(file);

    file = path.relative(this.workspaceRoot, file);

    if (file === "") {
      file = ".";
    }

    // Fix Peg Revision Algorithm (http://svnbook.red-bean.com/en/1.8/svn.advanced.pegrevs.html)
    if (/@/.test(file)) {
      file += "@";
    }

    return file;
  }

  public async getStatus(params: {
    includeIgnored?: boolean;
    includeExternals?: boolean;
    checkRemoteChanges?: boolean;
  }): Promise<IFileStatus[]> {
    params = Object.assign(
      {},
      {
        includeIgnored: false,
        includeExternals: true,
        checkRemoteChanges: false
      },
      params
    );

    const args = ["stat", "--xml"];

    if (params.includeIgnored) {
      args.push("--no-ignore");
    }
    if (!params.includeExternals) {
      args.push("--ignore-externals");
    }
    if (params.checkRemoteChanges) {
      args.push("--show-updates");
    }

    const result = await this.exec(args);

    const status: IFileStatus[] = await parseStatusXml(result.stdout);

    for (const s of status) {
      if (s.status === Status.EXTERNAL) {
        try {
          const info = await this.getInfo(s.path);
          s.repositoryUuid = info.repository.uuid;
        } catch (error) {
          console.error(error);
        }
      }
    }

    return status;
  }

  public resetInfo(file: string = "") {
    delete this._info[file];
  }

  @sequentialize
  public async getInfo(file: string = ""): Promise<ISvnInfo> {
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

  public async show(
    file: string,
    revision?: string,
    options: ICpOptions = {}
  ): Promise<string> {
    const uri = Uri.file(file);
    file = this.removeAbsolutePath(file);
    const args = ["cat"];

    if (revision) {
      if (!["BASE", "COMMITTED", "PREV"].includes(revision.toUpperCase())) {
        const info = await this.getInfo();

        args.push(info.url + "/" + file.replace(/\\/g, "/"));
        args.push("-r", revision);
      } else {
        args.push(file);
        args.push("-r", revision);
      }
    } else {
      args.push(file);
    }

    const encoding = workspace
      .getConfiguration("files", uri)
      .get<string>("encoding", "utf8");

    const result = await this.exec(args, { encoding });

    return result.stdout;
  }

  public async commitFiles(message: string, files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));

    const args = ["commit", ...files];

    if (fs.existsSync(path.join(this.workspaceRoot, message))) {
      args.push("--force-log");
    }

    let tmpFile: tmp.SynchrounousResult | undefined;

    /**
     * For message with line break or non:
     * \x00-\x7F -> ASCII
     * \x80-\xFF -> Latin
     * Use a file for commit message
     */
    if (/\n|[^\x00-\x7F\x80-\xFF]/.test(message)) {
      tmp.setGracefulCleanup();

      tmpFile = tmp.fileSync({
        prefix: "svn-commit-message-"
      });

      fs.writeFileSync(tmpFile.name, message, "UTF-8");

      args.push("-F", tmpFile.name);
      args.push("--encoding", "UTF-8");
    } else {
      args.push("-m", message);
    }

    // Prevents commit the files inside the folder
    args.push("--depth", "empty");

    const result = await this.exec(args);

    // Remove temporary file if exists
    if (tmpFile) {
      tmpFile.removeCallback();
    }

    const matches = result.stdout.match(/Committed revision (.*)\./i);
    if (matches && matches[0]) {
      return matches[0];
    }

    return result.stdout;
  }

  public addFiles(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["add", ...files]);
  }

  public addChangelist(files: string[], changelist: string) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["changelist", changelist, ...files]);
  }

  public removeChangelist(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["changelist", "--remove", ...files]);
  }

  public async getCurrentBranch(): Promise<string> {
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

  public async getRepositoryUuid(): Promise<string> {
    const info = await this.getInfo();

    return info.repository.uuid;
  }

  public async getRepoUrl() {
    const info = await this.getInfo();

    const branch = getBranchName(info.url);

    if (!branch) {
      return info.repository.root;
    }

    const regex = new RegExp(branch.path + "$");

    return info.url.replace(regex, "").replace(/\/$/, "");
  }

  public async getBranches() {
    const trunkLayout = configuration.get<string>("layout.trunk");
    const branchesLayout = configuration.get<string>("layout.branches");
    const tagsLayout = configuration.get<string>("layout.tags");

    const repoUrl = await this.getRepoUrl();

    const branches: string[] = [];

    const promises = [];

    if (trunkLayout) {
      promises.push(
        new Promise<string[]>(async resolve => {
          try {
            const trunkExists = await this.exec([
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

    const trees: string[] = [];

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

  public async newBranch(
    name: string,
    commitMessage: string = "Created new branch"
  ) {
    const repoUrl = await this.getRepoUrl();
    const newBranch = repoUrl + "/" + name;
    const info = await this.getInfo();
    const currentBranch = info.url;
    const result = await this.exec([
      "copy",
      currentBranch,
      newBranch,
      "-m",
      commitMessage
    ]);

    await this.switchBranch(name);

    return true;
  }

  public async switchBranch(ref: string) {
    const repoUrl = await this.getRepoUrl();

    const branchUrl = repoUrl + "/" + ref;

    try {
      await this.exec(["switch", branchUrl]);
    } catch (error) {
      const answer = await window.showErrorMessage(
        "Failed to switch branch: " +
          error.stderrFormated +
          " Do you want to retry with '--ignore-ancestry' option?",
        "Yes",
        "No"
      );
      if (answer === "Yes") {
        await this.exec(["switch", branchUrl, "--ignore-ancestry"]);
      }
    }

    this.resetInfo();

    return true;
  }

  public async revert(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.exec(["revert", ...files]);
    return result.stdout;
  }

  public async update(ignoreExternals: boolean = true): Promise<string> {
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

  public async pullIncomingChange(path: string): Promise<string> {
    const args = ["update", path];

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

  public async patch(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.exec(["diff", ...files]);
    const message = result.stdout;
    return message;
  }

  public async patchChangelist(changelistName: string) {
    const result = await this.exec(["diff", "--changelist", changelistName]);
    const message = result.stdout;
    return message;
  }

  public async removeFiles(files: string[], keepLocal: boolean) {
    files = files.map(file => this.removeAbsolutePath(file));
    const args = ["remove"];

    if (keepLocal) {
      args.push("--keep-local");
    }

    args.push(...files);

    const result = await this.exec(args);

    return result.stdout;
  }

  public async resolve(files: string[], action: string) {
    files = files.map(file => this.removeAbsolutePath(file));

    const result = await this.exec(["resolve", "--accept", action, ...files]);

    return result.stdout;
  }

  public async log() {
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

  public async countNewCommit(revision: string = "BASE:HEAD") {
    const result = await this.exec(["log", "-r", revision, "-q", "--xml"]);

    const matches = result.stdout.match(/<logentry/g);

    if (matches && matches.length > 0) {
      // Every return current commit
      return matches.length - 1;
    }

    return 0;
  }

  public async cleanup() {
    const result = await this.exec(["cleanup"]);

    return result.stdout;
  }

  public async finishCheckout() {
    const info = await this.getInfo();

    const result = await this.exec(["switch", info.url]);

    return result.stdout;
  }

  public async list(folder?: string) {
    let url = await this.getRepoUrl();

    if (folder) {
      url += "/" + folder;
    }

    const result = await this.exec(["list", url, "--xml"]);

    return parseSvnList(result.stdout);
  }

  public async getCurrentIgnore(directory: string) {
    directory = this.removeAbsolutePath(directory);

    let currentIgnore = "";

    try {
      const args = ["propget", "svn:ignore"];

      if (directory) {
        args.push(directory);
      }

      const currentIgnoreResult = await this.exec(args);

      currentIgnore = currentIgnoreResult.stdout.trim();
    } catch (error) {
      console.error(error);
    }

    const ignores = currentIgnore.split(/[\r\n]+/);

    return ignores;
  }

  public async addToIgnore(
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

  public async rename(oldName: string, newName: string): Promise<string> {
    oldName = this.removeAbsolutePath(oldName);
    newName = this.removeAbsolutePath(newName);
    const args = ["rename", oldName, newName];

    const result = await this.exec(args);

    return result.stdout;
  }
}
