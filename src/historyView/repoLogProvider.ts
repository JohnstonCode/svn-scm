import * as fs from "fs";
import * as path from "path";
import {
  commands,
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
  workspace
} from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { Model } from "../model";
import { Repository } from "../repository";
import { unwrap } from "../util";
import {
  checkIfFile,
  fetchMore,
  getCommitIcon,
  getCommitLabel,
  getCommitToolTip,
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

function elementUri(repo: Repository, itempath: string): Uri {
  return Uri.parse(repo.remoteRoot.toString() + itempath);
}

export class RepoLogProvider implements TreeDataProvider<ILogTreeItem> {
  private _onDidChangeTreeData: EventEmitter<
    ILogTreeItem | undefined
  > = new EventEmitter<ILogTreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<ILogTreeItem | undefined> = this
    ._onDidChangeTreeData.event;
  // TODO on-disk cache?
  private readonly logCache: Map<string, ICachedLog> = new Map();

  private getCached(maybeItem?: ILogTreeItem): ICachedLog {
    const item = unwrap(maybeItem);
    if (item.data instanceof SvnPath) {
      return unwrap(this.logCache.get(item.data.toString()));
    }
    return this.getCached(item.parent);
  }

  constructor(private model: Model) {
    this.refresh();
    commands.registerCommand("svn.repolog.addrepolike", this.addRepolike, this);
    commands.registerCommand("svn.repolog.remove", this.removeRepo, this);
    commands.registerCommand(
      "svn.repolog.openFileRemote",
      this.openFileRemote,
      this
    );
    commands.registerCommand("svn.repolog.openDiff", this.openDiff, this);
    commands.registerCommand("svn.repolog.refresh", this.refresh, this);
  }

  public removeRepo(element: ILogTreeItem) {
    this.logCache.delete((element.data as SvnPath).toString());
    this.refresh();
  }

  public addRepolike() {
    const box = window.createInputBox();
    box.prompt = "Enter SVN URL or local path";
    box.onDidAccept(() => {
      let repoLike = box.value;
      if (
        !path.isAbsolute(repoLike) &&
        workspace.workspaceFolders &&
        !repoLike.startsWith("^") &&
        !/^[a-z]+?:\/\//.test(repoLike)
      ) {
        for (const wsf of workspace.workspaceFolders) {
          const joined = path.join(wsf.uri.path, repoLike);
          if (fs.existsSync(joined)) {
            repoLike = joined;
            break;
          }
        }
      }
      box.dispose();
      const box2 = window.createInputBox();
      box2.prompt = "Enter starting revision (optional)";
      box2.onDidAccept(async () => {
        console.log(box2.value);
        const repo = this.model.getRepository(repoLike);
        let success = false;
        if (repo !== undefined) {
          try {
            const rev = box2.value;
            const svninfo = await repo.getInfo(repoLike, rev);
            this.logCache.set(repoLike, {
              entries: [],
              isComplete: false,
              svnTarget: Uri.parse(svninfo.url),
              repo,
              persisted: {
                commitFrom: svninfo.revision,
                userAdded: true
              }
            });
            success = true;
            this._onDidChangeTreeData.fire();
          } catch {
            // ignore
          }
        }
        if (!success) {
          window.showErrorMessage("Failed to resolve svn path");
        }
        box2.dispose();
      });
      box2.show();
    });
    box.show();
  }

  public openFileRemote(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    if (!checkIfFile(commit)) {
      return;
    }
    const item = this.getCached(element);
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    commands.executeCommand(
      "svn.openFileRemote",
      item.repo,
      elementUri(item.repo, commit._),
      parent.revision
    );
  }

  public openDiff(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    if (!checkIfFile(commit)) {
      return;
    }
    const item = this.getCached(element);
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    const pos = item.entries.findIndex(e => e === parent);
    let posPrev: number | undefined;
    for (
      let i = pos + 1;
      posPrev === undefined && i < item.entries.length;
      i++
    ) {
      for (const p of item.entries[i].paths) {
        if (p._ === commit._) {
          posPrev = i;
          break;
        }
      }
    }
    if (posPrev === undefined) {
      window.showWarningMessage("Cannot find previous commit");
      return;
    }
    commands.executeCommand(
      "svn.openDiff",
      item.repo,
      elementUri(item.repo, commit._),
      parent.revision,
      item.entries[posPrev].revision
    );
  }

  public async refresh(element?: ILogTreeItem) {
    if (element === undefined) {
      for (const repo of this.model.repositories) {
        const repoUrl = repo.remoteRoot.toString();
        let persisted = {
          commitFrom: "HEAD"
        };
        const prev = this.logCache.get(repoUrl);
        if (prev) {
          persisted = prev.persisted;
        }
        this.logCache.set(repoUrl, {
          entries: [],
          isComplete: false,
          repo,
          svnTarget: repo.remoteRoot,
          persisted
        });
      }
    } else if (element.kind === LogTreeItemKind.Repo) {
      const cached = this.getCached(element);
      await fetchMore(cached);
    }
    this._onDidChangeTreeData.fire(element);
  }

  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    let ti: TreeItem;
    if (element.kind === LogTreeItemKind.Repo) {
      const svnTarget = element.data as SvnPath;
      const cached = this.getCached(element);
      ti = new TreeItem(
        svnTarget.toString(),
        TreeItemCollapsibleState.Collapsed
      );
      if (cached.persisted.userAdded) {
        ti.iconPath = getIconObject("folder");
        ti.contextValue = "userrepo";
      } else {
        ti.iconPath = getIconObject("icon-repo");
      }
      const from = cached.persisted.commitFrom || "HEAD";
      ti.tooltip = `${svnTarget} since ${from}`;
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      ti = new TreeItem(
        getCommitLabel(commit),
        TreeItemCollapsibleState.Collapsed
      );
      ti.tooltip = getCommitToolTip(commit);
      ti.iconPath = getCommitIcon(commit.author);
      ti.contextValue = "commit";
    } else if (element.kind === LogTreeItemKind.CommitDetail) {
      const pathElem = element.data as ISvnLogEntryPath;
      const basename = path.basename(pathElem._);
      ti = new TreeItem(basename, TreeItemCollapsibleState.None);
      ti.tooltip = path.dirname(pathElem._);
      ti.iconPath = getActionIcon(pathElem.action);
      ti.contextValue = "diffable";
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
      return transform(
        Array.from(this.logCache.keys()).map(s => new SvnPath(s)),
        LogTreeItemKind.Repo
      );
    } else if (element.kind === LogTreeItemKind.Repo) {
      const limit = getLimit();
      const cached = this.getCached(element);
      const logentries = cached.entries;
      if (logentries.length === 0) {
        await fetchMore(cached);
      }
      const result = transform(logentries, LogTreeItemKind.Commit, element);
      if (!cached.isComplete) {
        const ti = new TreeItem(`Load another ${limit} revisions`);
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.repolog.refresh",
          arguments: [element],
          title: "refresh element"
        };
        ti.iconPath = getIconObject("icon-unfold");
        result.push({ kind: LogTreeItemKind.Action, data: ti });
      }
      return result;
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      return transform(commit.paths, LogTreeItemKind.CommitDetail, element);
    }
    return [];
  }
}
