import * as path from "path";
import {
  commands,
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  window,
  workspace
} from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { Model } from "../model";
import { Repository } from "../repository";
import { Repository as BaseRepository } from "../svnRepository";
import {
  fetchMore,
  getCommitLabel,
  getGravatarUri,
  getIconObject,
  getLimit,
  ICachedLog,
  ILogTreeItem,
  LogTreeItemKind,
  SvnPath,
  transform
} from "./common";

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
  // TODO on-disk cache?
  private readonly logCache: Map<string, ICachedLog> = new Map();

  constructor(private model: Model) {
    this.refresh();
    commands.registerCommand("svn.log.addrepolike", this.addRepolike, this);
  }

  public addRepolike() {
    const box = window.createInputBox();
    box.prompt = "Enter SVN URL or local path";
    box.onDidAccept(() => {
      let repoLike = box.value;
      if (!path.isAbsolute(repoLike)) {
        if (workspace.workspaceFolders && workspace.workspaceFolders.length) {
          repoLike = path.join(
            workspace.workspaceFolders[0].uri.path,
            repoLike
          );
          // TODO detect ws folder
        }
      }
      box.dispose();
      const box2 = window.createInputBox();
      box2.prompt = "Enter starting commit (default HEAD)";
      box2.onDidAccept(() => {
        console.log(box2.value);
        const svnRepo = new BaseRepository(this.model.svn, repoLike, repoLike);
        const repo = new Repository(svnRepo);
        if (repo !== undefined) {
          this.logCache.set(repoLike, {
            entries: [],
            isComplete: false,
            svnTarget: repoLike,
            repo
          });
          this._onDidChangeTreeData.fire();
        }
        box2.dispose();
      });
      box2.show();
    });
    box.show();
  }

  public async refresh(element?: ILogTreeItem) {
    if (element === undefined) {
      // this.logCache.clear();
      for (const repo of this.model.repositories) {
        const repoUrl = await repo.getInfo(repo.root);
        this.logCache.set(repoUrl.url, {
          entries: [],
          isComplete: false,
          repo,
          svnTarget: repoUrl.url
        });
      }
    } else if (element.kind === LogTreeItemKind.Repo) {
      const repoRoot = element.data as SvnPath;
      const cached = this.logCache.get(repoRoot);
      if (cached === undefined) {
        throw new Error("undefined cached");
      }
      await fetchMore(cached);
    }
    this._onDidChangeTreeData.fire(element);
  }

  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    let ti: TreeItem;
    if (element.kind === LogTreeItemKind.Repo) {
      const repoRoot = element.data as SvnPath;
      ti = new TreeItem(repoRoot, TreeItemCollapsibleState.Collapsed);
      ti.iconPath = getIconObject("icon-repo");
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      ti = new TreeItem(
        getCommitLabel(commit),
        TreeItemCollapsibleState.Collapsed
      );
      let date = commit.date;
      if (!isNaN(Date.parse(date))) {
        date = new Date(date).toString();
      }
      ti.tooltip = `Author ${commit.author}\n${date}\nRevision ${
        commit.revision
      }`;
      ti.iconPath = getGravatarUri(commit.author);
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
      const limit = getLimit();
      const repoRoot = element.data as SvnPath;
      const cached = this.logCache.get(repoRoot);
      if (cached === undefined) {
        throw new Error("no logentries for " + repoRoot);
      }
      const logentries = cached.entries;
      if (logentries.length === 0) {
        await fetchMore(cached);
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
