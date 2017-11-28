import { workspace } from "vscode";
import { Svn, CpOptions } from "./svn";

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
    const config = workspace.getConfiguration("svn");
    const trunkLayout = config.get<string>("layout.trunk");
    const branchesLayout = config.get<string>("layout.branches");
    const tagsLayout = config.get<string>("layout.tags");

    const trees = [trunkLayout, branchesLayout, tagsLayout].filter(x => x != null);
    const regex = new RegExp("<url>(.*?)\/(" + trees.join("|") + ").*?<\/url>");

    const info = await this.svn.info(this.root);

    if (info.exitCode !== 0) {
      throw new Error(info.stderr);
    }

    let repoUrl = info.stdout.match(/<root>(.*?)<\/root>/)[1];
    const match = info.stdout.match(regex);

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

    for (let index in trees) {
      promises.push(
        new Promise<string[]>(async resolve => {
          const tree = trees[index];
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
    const resultBranch = await this.svn.info(this.root);
    const currentBranch = resultBranch.stdout
      .match(/<url>(.*?)<\/url>/)[1];

    const result = await this.svn.copy(currentBranch, newBranch, name);

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
