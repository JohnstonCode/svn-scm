import * as path from "path";
import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri
} from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { configuration } from "../helpers/configuration";
import { Model } from "../model";
import { Repository } from "../repository";

enum LogTreeItemKind {
  Repo,
  Commit,
  CommitDetail,
  Action
}

type RepoRoot = string;

interface ILogTreeItem {
  kind: LogTreeItemKind;
  data: ISvnLogEntry | ISvnLogEntryPath | RepoRoot | TreeItem;
}

interface ICachedLog {
  repo: Repository;
  entries: ISvnLogEntry[];
  isComplete: boolean;
}

function transform(array: any[], kind: LogTreeItemKind): ILogTreeItem[] {
  return array.map(data => {
    return { kind, data };
  });
}

// XXX code duplication with uri.ts. Maybe use full path?
function getIconObject(iconName: string) {
  const iconsRootPath = path.join(__dirname, "..", "..", "icons");
  const toUri = (theme: string) =>
    Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
  return {
    light: toUri("light"),
    dark: toUri("dark")
  };
}

function getActionIcon(action: string) {
  let name: string | undefined;
  switch (action) {
    case "A":
      name = "status-added";
      break;
    case "D":
      name = "status-deleted";
      break;
    case "M":
      name = "status-modified";
      break;
    case "R":
      name = "status-renamed";
      break;
  }
  if (name === undefined) {
    return undefined;
  }
  return getIconObject(name);
}

export class LogProvider implements TreeDataProvider<ILogTreeItem> {
  private _onDidChangeTreeData: EventEmitter<
    ILogTreeItem | undefined
  > = new EventEmitter<ILogTreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<ILogTreeItem | undefined> = this
    ._onDidChangeTreeData.event;
  private readonly logCache: Map<string, ICachedLog> = new Map();

  constructor(private model: Model) {
    this.refresh();
  }

  public async refresh(element?: ILogTreeItem) {
    if (element === undefined) {
      this.logCache.clear();
      for (const repo of this.model.repositories) {
        this.logCache.set(repo.root, {
          entries: [],
          isComplete: false,
          repo
        });
      }
    } else if (element.kind === LogTreeItemKind.Repo) {
      const repoRoot = element.data as RepoRoot;
      await this.fetchMore(repoRoot);
    }
    this._onDidChangeTreeData.fire(element);
  }

  private findRepo(repoRoot: RepoRoot): Repository {
    const repo = this.model.repositories.find(r => r.root === repoRoot);
    if (repo === undefined) {
      throw new Error(`Repo ${repo} not found`);
    }
    return repo;
  }

  private async fetchMore(repoRoot: RepoRoot) {
    const cached = this.logCache.get(repoRoot);
    if (cached === undefined) {
      throw new Error("no logentries for " + repoRoot);
    }
    const logentries = cached.entries;
    let rfrom = "HEAD";
    if (logentries.length) {
      rfrom = logentries[logentries.length - 1].revision;
      rfrom = (Number.parseInt(rfrom, 10) - 1).toString();
    }
    const repo = this.findRepo(repoRoot);
    const moreCommits = await repo.log2(rfrom, "1", this.getLimit());
    logentries.push(...moreCommits);
    if (
      moreCommits.length === 0 ||
      moreCommits[moreCommits.length - 1].revision === "1"
    ) {
      cached.isComplete = true;
    }
  }

  private getLimit(): number {
    const limit = Number.parseInt(
      configuration.get<string>("log.length") || "50",
      10
    );
    if (isNaN(limit) || limit <= 0) {
      throw new Error("Invalid log.length setting value");
    }
    return limit;
  }

  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    let ti: TreeItem;
    if (element.kind === LogTreeItemKind.Repo) {
      const repoRoot = element.data as RepoRoot;
      ti = new TreeItem(repoRoot, TreeItemCollapsibleState.Collapsed);
      ti.iconPath = getIconObject("icon-repo");
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      ti = new TreeItem(
        `${commit.msg} • r${commit.revision}`,
        TreeItemCollapsibleState.Collapsed
      );
      let date = commit.date;
      if (!isNaN(Date.parse(date))) {
        date = new Date(date).toString();
      }
      ti.tooltip = `Author ${commit.author}\n${date}\nRevision ${
        commit.revision
      }`;
    } else if (element.kind === LogTreeItemKind.CommitDetail) {
      const pathElem = element.data as ISvnLogEntryPath;
      const basename = path.basename(pathElem._);
      ti = new TreeItem(basename, TreeItemCollapsibleState.None);
      ti.tooltip = path.dirname(pathElem._);
      ti.iconPath = getActionIcon(pathElem.action);
    } else if (element.kind === LogTreeItemKind.Action) {
      ti = element.data as TreeItem;
    } else {
      throw new Error("Unknown tree elem");
    }

    return ti;
  }

  public async getChildren(
    element: ILogTreeItem | undefined
  ): Promise<ILogTreeItem[]> {
    if (element === undefined) {
      return transform(Array.from(this.logCache.keys()), LogTreeItemKind.Repo);
    } else if (element.kind === LogTreeItemKind.Repo) {
      const limit = this.getLimit();
      const repoRoot = element.data as RepoRoot;
      const cached = this.logCache.get(repoRoot);
      if (cached === undefined) {
        throw new Error("no logentries for " + repoRoot);
      }
      const logentries = cached.entries;
      if (logentries.length === 0) {
        await this.fetchMore(repoRoot);
      }
      const result = transform(logentries, LogTreeItemKind.Commit);
      if (!cached.isComplete) {
        const ti = new TreeItem(`Load another ${limit} revisions`);
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.log.refresh",
          arguments: [element],
          title: "refresh element"
        };
        ti.iconPath = getIconObject("icon-unfold");
        result.push({ kind: LogTreeItemKind.Action, data: ti });
      }
      return result;
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      return transform(commit.paths, LogTreeItemKind.CommitDetail);
    }
    return [];
  }
}
