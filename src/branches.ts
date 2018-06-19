import { Repository } from "./repository";
import { SvnKindType, ISvnListItem } from "./listParser";
import { QuickPickItem, window, ProgressLocation } from "vscode";
import { configuration } from "./helpers/configuration";
import { memoize } from "./decorators";

export interface BranchItem {
  path: string;
  name: string;
  isNew?: boolean;
}

export function getBranchName(folder: string): BranchItem | undefined {
  const confs = [
    "layout.trunkRegex",
    "layout.branchesRegex",
    "layout.tagsRegex"
  ];

  for (const conf of confs) {
    const layout = configuration.get<string>(conf);
    if (!layout) {
      continue;
    }
    const group = configuration.get<number>(`${conf}Name`, 1) + 2;

    const regex = new RegExp(`(^|/)(${layout})$`);

    const matches = folder.match(regex);
    if (matches && matches[2] && matches[group]) {
      return {
        path: matches[2],
        name: matches[group]
      };
    }
  }
}

export class FolderItem implements QuickPickItem {
  constructor(protected _dir: ISvnListItem, protected _parent?: string) {}

  get label(): string {
    if (this.branch) {
      return `$(git-branch) ${this._dir.name}`;
    }
    return `$(file-directory) ${this._dir.name}`;
  }

  get description(): string {
    return `r${this._dir.commit.revision} | ${
      this._dir.commit.author
    } | ${new Date(this._dir.commit.date).toLocaleString()}`;
  }

  get path(): string {
    if (this._parent) {
      return `${this._parent}/${this._dir.name}`;
    }
    return this._dir.name;
  }

  @memoize
  get branch(): BranchItem | undefined {
    return getBranchName(this.path);
  }
}

export class NewFolderItem implements QuickPickItem {
  constructor(protected _parent: string) {}

  get label(): string {
    return `$(plus) Create new branch`;
  }

  get description(): string {
    return `Create new branch in "${this._parent}"`;
  }
}

export class ParentFolderItem implements QuickPickItem {
  constructor(public path?: string) {}

  get label(): string {
    return `$(arrow-left) back to /${this.path}`;
  }
  get description(): string {
    return `Back to parent`;
  }
}

export async function selectBranch(
  repository: Repository,
  allowNew = false,
  folder?: string
): Promise<BranchItem | undefined> {
  const promise = repository.repository.list(folder);

  window.withProgress(
    { location: ProgressLocation.Window, title: "Checking remote branches" },
    () => promise
  );

  const list = await promise;

  const dirs = list.filter(item => item.kind === SvnKindType.DIR);

  const picks = [];

  if (folder) {
    const parts = folder.split("/");
    parts.pop();
    const parent = parts.join("/");
    picks.push(new ParentFolderItem(parent));
  }

  if (allowNew && folder && !!getBranchName(`${folder}/test`)) {
    picks.push(new NewFolderItem(folder));
  }

  picks.push(...dirs.map(dir => new FolderItem(dir, folder)));

  const choice = await window.showQuickPick(picks);

  if (!choice) {
    return;
  }

  if (choice instanceof ParentFolderItem) {
    return selectBranch(repository, allowNew, choice.path);
  }
  if (choice instanceof FolderItem) {
    if (choice.branch) {
      return choice.branch;
    }

    return selectBranch(repository, allowNew, choice.path);
  }

  if (choice instanceof NewFolderItem) {
    const result = await window.showInputBox({
      prompt: "Please provide a branch name",
      ignoreFocusOut: true
    });

    if (!result) {
      return;
    }

    const name = result.replace(
      /^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g,
      "-"
    );

    const newBranch = getBranchName(`${folder}/${name}`);
    if (newBranch) {
      newBranch.isNew = true;
    }

    return newBranch;
  }
}
