import { workspace } from "vscode";
import { Svn, CpOptions } from "./svn";
import { IFileStatus, parseStatusXml } from "./statusParser";
import { parseInfoXml, ISvnInfo } from "./infoParser";

export class Repository {
  private _info?: ISvnInfo;

  constructor(
    private svn: Svn,
    public root: string,
    public workspaceRoot: string
  ) {}

  async getStatus(): Promise<IFileStatus[]> {
    const result = await this.svn.exec(this.workspaceRoot, ["stat", "--xml"]);

    return await parseStatusXml(result.stdout);
  }

  resetInfo() {
    this._info = undefined;
  }

  async getInfo(): Promise<ISvnInfo> {
    if (this._info) {
      return this._info;
    }
    const result = await this.svn.info(this.workspaceRoot);

    this._info = await parseInfoXml(result.stdout);

    // Cache for 30 seconds
    setTimeout(() => {
      this.resetInfo();
    }, 30000);

    return this._info;
  }

  async show(
    path: string,
    revision?: string,
    options: CpOptions = {}
  ): Promise<string> {
    const result = await this.svn.show(path, revision, options);

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

    const outputMessage = result.stdout.match(/Committed revision (.*)\./i)[0];

    return outputMessage;
  }

  addFile(filePath: string) {
    return this.svn.add(filePath);
  }

  addChangelist(filePath: string, changelist: string) {
    return this.svn.addChangelist(filePath, changelist);
  }

  removeChangelist(filePath: string) {
    return this.svn.removeChangelist(filePath);
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
          let trunkExists = await this.svn.exec("", [
            "ls",
            repoUrl + "/" + trunkLayout,
            "--depth",
            "empty"
          ]);

          if (trunkExists.exitCode === 0) {
            resolve([trunkLayout]);
            return;
          }
          resolve([]);
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

          const result = await this.svn.list(branchUrl);

          if (result.exitCode !== 0) {
            resolve([]);
            return;
          }

          const list = result.stdout
            .trim()
            .replace(/\/|\\/g, "")
            .split(/[\r\n]+/)
            .filter((x: string) => !!x)
            .map((i: string) => tree + "/" + i);

          resolve(list);
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
    const result = await this.svn.copy(currentBranch, newBranch, name);

    const switchBranch = await this.svn.switchBranch(
      this.workspaceRoot,
      newBranch
    );

    if (switchBranch.exitCode !== 0) {
      throw new Error(switchBranch.stderr);
    }

    this.resetInfo();

    return true;
  }

  async switchBranch(ref: string) {
    const repoUrl = await this.getRepoUrl();

    const branchUrl = repoUrl + "/" + ref;

    const switchBranch = await this.svn.switchBranch(
      this.workspaceRoot,
      branchUrl
    );

    if (switchBranch.exitCode !== 0) {
      throw new Error(switchBranch.stderr);
    }

    this.resetInfo();

    return true;
  }

  async revert(files: any[]) {
    const result = await this.svn.revert(files);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    return result.stdout;
  }

  async update() {
    const result = await this.svn.update(this.workspaceRoot);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    const message = result.stdout
      .trim()
      .split(/\r?\n/)
      .pop();

    return message;
  }

  async patch() {
    const result = await this.svn.patch(this.workspaceRoot);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    const message = result.stdout;
    return message;
  }

  async removeFiles(files: any[], keepLocal: boolean) {
    const result = await this.svn.remove(files, keepLocal);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    return result.stdout;
  }

  async resolve(file: string, action: string) {
    const result = await this.svn.resolve(file, action);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    return result.stdout;
  }
}
