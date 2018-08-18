import { QuickPickItem } from "vscode";
import { IBranchItem } from "../common/types";
import { ISvnListItem } from "../common/types";
import { memoize } from "../decorators";
import { getBranchName } from "../helpers/branch";

export default class FolderItem implements QuickPickItem {
  constructor(protected dir: ISvnListItem, protected parent?: string) {}

  get label(): string {
    if (this.branch) {
      return `$(git-branch) ${this.dir.name}`;
    }
    return `$(file-directory) ${this.dir.name}`;
  }

  get description(): string {
    return `r${this.dir.commit.revision} | ${
      this.dir.commit.author
    } | ${new Date(this.dir.commit.date).toLocaleString()}`;
  }

  get path(): string {
    if (this.parent) {
      return `${this.parent}/${this.dir.name}`;
    }
    return this.dir.name;
  }

  @memoize
  get branch(): IBranchItem | undefined {
    return getBranchName(this.path);
  }
}
