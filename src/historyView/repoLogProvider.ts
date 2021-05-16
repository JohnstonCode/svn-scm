import * as path from "path";
import {
  commands,
  Disposable,
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
  RepositoryChangeEvent,
  ISvnLogEntry,
  ISvnLogEntryPath
} from "../common/types";
import { exists } from "../fs";
import { SourceControlManager } from "../source_control_manager";
import { IRemoteRepository } from "../remoteRepository";
import { Repository } from "../repository";
import { dispose, unwrap } from "../util";
import {
  checkIfFile,
  copyCommitToClipboard,
  fetchMore,
  getCommitIcon,
  getCommitLabel,
  getCommitToolTip,
  getIconObject,
  getLimit,
  ICachedLog,
  ILogTreeItem,
  insertBaseMarker,
  LogTreeItemKind,
  openDiff,
  openFileRemote,
  SvnPath,
  transform,
  getCommitDescription
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

export class RepoLogProvider
  implements TreeDataProvider<ILogTreeItem>, Disposable
{
  private _onDidChangeTreeData: EventEmitter<ILogTreeItem | undefined> =
    new EventEmitter<ILogTreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<ILogTreeItem | undefined> =
    this._onDidChangeTreeData.event;
  // TODO on-disk cache?
  private readonly logCache: Map<string, ICachedLog> = new Map();
  private _dispose: Disposable[] = [];

  private getCached(maybeItem?: ILogTreeItem): ICachedLog {
    const item = unwrap(maybeItem);
    if (item.data instanceof SvnPath) {
      return unwrap(this.logCache.get(item.data.toString()));
    }
    return this.getCached(item.parent);
  }

  constructor(private sourceControlManager: SourceControlManager) {
    this.refresh();
    this._dispose.push(
      window.registerTreeDataProvider("repolog", this),
      commands.registerCommand(
        "svn.repolog.copymsg",
        async (item: ILogTreeItem) => copyCommitToClipboard("msg", item)
      ),
      commands.registerCommand(
        "svn.repolog.copyrevision",
        async (item: ILogTreeItem) => copyCommitToClipboard("revision", item)
      ),
      commands.registerCommand(
        "svn.repolog.addrepolike",
        this.addRepolikeGui,
        this
      ),
      commands.registerCommand("svn.repolog.remove", this.removeRepo, this),
      commands.registerCommand(
        "svn.repolog.openFileRemote",
        this.openFileRemoteCmd,
        this
      ),
      commands.registerCommand("svn.repolog.openDiff", this.openDiffCmd, this),
      commands.registerCommand(
        "svn.repolog.openFileLocal",
        this.openFileLocal,
        this
      ),
      commands.registerCommand("svn.repolog.refresh", this.refresh, this),
      this.sourceControlManager.onDidChangeRepository(
        async (_e: RepositoryChangeEvent) => {
          return this.refresh();
          // TODO refresh only required repo, need to pass element === getChildren()
        }
      )
    );
  }

  public dispose() {
    dispose(this._dispose);
  }

  public removeRepo(element: ILogTreeItem) {
    this.logCache.delete((element.data as SvnPath).toString());
    this.refresh();
  }

  private async addRepolike(repoLike: string, rev: string) {
    // TODO save user's custom repositories
    const item: ICachedLog = {
      entries: [],
      isComplete: false,
      svnTarget: {} as Uri, // later
      repo: {} as IRemoteRepository, // later
      persisted: {
        commitFrom: rev,
        userAdded: true
      },
      order: this.logCache.size
    };
    if (this.logCache.has(repoLike)) {
      window.showWarningMessage("This path is already added");
      return;
    }
    const repo = this.sourceControlManager.getRepository(repoLike);
    if (repo === null) {
      try {
        let uri: Uri;
        if (repoLike.startsWith("^")) {
          const wsrepo = this.sourceControlManager.getRepository(
            unwrap(workspace.workspaceFolders)[0].uri
          );
          if (!wsrepo) {
            throw new Error("No repository in workspace root");
          }
          const info = await wsrepo.getInfo(repoLike);
          uri = Uri.parse(info.url);
        } else {
          uri = Uri.parse(repoLike);
        }
        if (rev !== "HEAD" && isNaN(parseInt(rev, 10))) {
          throw new Error("erroneous revision");
        }
        const remRepo = await this.sourceControlManager.getRemoteRepository(
          uri
        );
        item.repo = remRepo;
        item.svnTarget = uri;
      } catch (e) {
        window.showWarningMessage(
          "Failed to add repo: " + (e instanceof Error ? e.message : "")
        );
        return;
      }
    } else {
      try {
        const svninfo = await repo.getInfo(repoLike, rev);
        item.repo = repo;
        item.svnTarget = Uri.parse(svninfo.url);
        item.persisted.baseRevision = parseInt(svninfo.revision, 10);
      } catch (e) {
        window.showErrorMessage("Failed to resolve svn path");
        return;
      }
    }

    const repoName = item.svnTarget.toString(true);
    if (this.logCache.has(repoName)) {
      window.showWarningMessage("Repository with this name already exists");
      return;
    }
    this.logCache.set(repoName, item);
    this._onDidChangeTreeData.fire();
  }

  public addRepolikeGui() {
    const box = window.createInputBox();
    box.prompt = "Enter SVN URL or local path";
    box.onDidAccept(async () => {
      let repoLike = box.value;
      if (
        !path.isAbsolute(repoLike) &&
        workspace.workspaceFolders &&
        !repoLike.startsWith("^") &&
        !/^[a-z]+?:\/\//.test(repoLike)
      ) {
        for (const wsf of workspace.workspaceFolders) {
          const joined = path.join(wsf.uri.fsPath, repoLike);
          if (await exists(joined)) {
            repoLike = joined;
            break;
          }
        }
      }
      box.dispose();
      const box2 = window.createInputBox();
      box2.prompt = "Enter starting revision (optional)";
      box2.onDidAccept(async () => {
        const rev = box2.value;
        box2.dispose();
        return this.addRepolike(repoLike, rev || "HEAD");
      }, undefined);
      box2.show();
    });
    box.show();
  }

  public async openFileRemoteCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if ((await checkIfFile(ri, false)) === false) {
      return;
    }
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    return openFileRemote(item.repo, ri.remoteFullPath, parent.revision);
  }

  public openFileLocal(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if (!checkIfFile(ri, true)) {
      return;
    }
    commands.executeCommand("vscode.open", unwrap(ri.localFullPath));
  }

  public async openDiffCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntryPath;
    const item = this.getCached(element);
    const parent = (element.parent as ILogTreeItem).data as ISvnLogEntry;
    const remotePath = item.repo
      .getPathNormalizer()
      .parse(commit._).remoteFullPath;
    let prevRev: ISvnLogEntry;

    const revs = await item.repo.log(parent.revision, "1", 2, remotePath);

    if (revs.length === 2) {
      prevRev = revs[1];
    } else {
      window.showWarningMessage("Cannot find previous commit");
      return;
    }

    return openDiff(item.repo, remotePath, prevRev.revision, parent.revision);
  }

  public async refresh(element?: ILogTreeItem, fetchMoreClick?: boolean) {
    if (element === undefined) {
      for (const [k, v] of this.logCache) {
        // Remove auto-added repositories
        if (!v.persisted.userAdded) {
          this.logCache.delete(k);
        }
      }
      for (const repo of this.sourceControlManager.repositories) {
        const remoteRoot = repo.branchRoot;
        const repoUrl = remoteRoot.toString(true);
        let persisted: ICachedLog["persisted"] = {
          commitFrom: "HEAD",
          baseRevision: parseInt(repo.repository.info.revision, 10)
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
          persisted,
          order: this.logCache.size
        });
      }
    } else if (element.kind === LogTreeItemKind.Repo) {
      const cached = this.getCached(element);
      if (fetchMoreClick) {
        await fetchMore(cached);
      } else {
        cached.entries = [];
        cached.isComplete = false;
      }
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
        ti.label = "∘ " + ti.label;
        ti.contextValue = "userrepo";
      } else {
        ti.contextValue = "repo";
      }
      if (cached.repo instanceof Repository) {
        ti.iconPath = getIconObject("folder");
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
      ti.description = getCommitDescription(commit);
      ti.tooltip = getCommitToolTip(commit);
      ti.iconPath = getCommitIcon(commit.author);
      ti.contextValue = "commit";
    } else if (element.kind === LogTreeItemKind.CommitDetail) {
      // TODO optional tree-view instead of flat
      const pathElem = element.data as ISvnLogEntryPath;
      const basename = path.basename(pathElem._);
      ti = new TreeItem(basename, TreeItemCollapsibleState.None);
      ti.description = path.dirname(pathElem._);
      const cached = this.getCached(element);
      const nm = cached.repo.getPathNormalizer();
      ti.tooltip = nm.parse(pathElem._).relativeFromBranch;
      ti.iconPath = getActionIcon(pathElem.action);
      ti.contextValue = "diffable";
      ti.command = {
        command: "svn.repolog.openDiff",
        title: "Open diff",
        arguments: [element]
      };
    } else if (element.kind === LogTreeItemKind.TItem) {
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
        Array.from(this.logCache.entries())
          .sort(([_lk, lv], [_rk, rv]): number => {
            if (lv.persisted.userAdded !== rv.persisted.userAdded) {
              return lv.persisted.userAdded ? 1 : -1;
            }
            return lv.order - rv.order;
          })
          .map(([k, _v]) => new SvnPath(k)),
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
      insertBaseMarker(cached, logentries, result);
      if (!cached.isComplete) {
        const ti = new TreeItem(`Load another ${limit} revisions`);
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.repolog.refresh",
          arguments: [element, true],
          title: "refresh element"
        };
        ti.iconPath = getIconObject("icon-unfold");
        result.push({ kind: LogTreeItemKind.TItem, data: ti });
      }
      return result;
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      return transform(commit.paths, LogTreeItemKind.CommitDetail, element);
    }
    return [];
  }
}
