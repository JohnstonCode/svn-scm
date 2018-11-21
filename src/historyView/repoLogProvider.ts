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
import {
  IModelChangeEvent,
  ISvnLogEntry,
  ISvnLogEntryPath
} from "../common/types";
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
    commands.registerCommand(
      "svn.repolog.openFileLocal",
      this.openFileLocal,
      this
    );
    commands.registerCommand("svn.repolog.refresh", this.refresh, this);
    this.model.onDidChangeRepository(async (e: IModelChangeEvent) => {
      return this.refresh();
    }, this);
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
        const repo = this.model.getRepository(repoLike);
        if (repo === undefined) {
          box2.dispose();
          window.showWarningMessage(
            "Provided path doesn't belong" +
              " to repositories opened in this workspace"
          );
          return;
        }
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
          this._onDidChangeTreeData.fire();
        } catch (e) {
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
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if (!checkIfFile(ri)) {
      return;
    }
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    commands.executeCommand(
      "svn.openFileRemote",
      item.repo,
      ri.remoteFullPath,
      parent.revision
    );
  }

  public openFileLocal(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if (!checkIfFile(ri)) {
      return;
    }
    if (!fs.existsSync(ri.localFullPath.path)) {
      window.showWarningMessage(
        "Not available from this working copy: " + ri.localFullPath
      );
      return;
    }
    commands.executeCommand("vscode.open", ri.localFullPath);
  }

  public async openDiff(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if (!checkIfFile(ri)) {
      return;
    }
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    let prevRev: ISvnLogEntry;
    {
      // find prevRev scope
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
      if (posPrev !== undefined) {
        prevRev = item.entries[posPrev];
      } else {
        // if not found in cache
        const nm = item.repo.getPathNormalizer();
        const revs = await item.repo.log(
          parent.revision,
          "1",
          2,
          nm.parse(commit._).remoteFullPath
        );
        if (revs.length === 2) {
          prevRev = revs[1];
        } else {
          window.showWarningMessage("Cannot find previous commit");
          return;
        }
      }
    }
    commands.executeCommand(
      "svn.openDiff",
      item.repo,
      ri.remoteFullPath,
      prevRev.revision,
      parent.revision
    );
  }

  public async refresh(element?: ILogTreeItem) {
    if (element === undefined) {
      for (const [k, v] of this.logCache) {
        // Remove auto-added repositories
        if (!v.persisted.userAdded) {
          this.logCache.delete(k);
        }
      }
      for (const repo of this.model.repositories) {
        const remoteRoot = repo.remoteRoot;
        const repoUrl = remoteRoot.toString();
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
          svnTarget: remoteRoot,
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
      // TODO optional tree-view instead of flat
      const pathElem = element.data as ISvnLogEntryPath;
      const basename = path.basename(pathElem._);
      ti = new TreeItem(basename, TreeItemCollapsibleState.None);
      const cached = this.getCached(element);
      const nm = cached.repo.getPathNormalizer();
      ti.tooltip = nm.parse(pathElem._).relativeFromBranch;
      ti.iconPath = getActionIcon(pathElem.action);
      ti.contextValue = "diffable";
      ti.command = {
        command: "svn.repolog.openFileLocal",
        title: "try to open WC version of a file",
        arguments: [element]
      };
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
