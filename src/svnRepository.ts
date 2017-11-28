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
