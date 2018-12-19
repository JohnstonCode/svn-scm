import {
  commands,
  Event,
  EventEmitter,
  TextEditor,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window
} from "vscode";
import { ISvnLogEntry, Status } from "../common/types";
import { Model } from "../model";
import { tempdir } from "../tempFiles";
import { unwrap } from "../util";
import {
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
  transform
} from "./common";

export class ItemLogProvider implements TreeDataProvider<ILogTreeItem> {
  private _onDidChangeTreeData: EventEmitter<
    ILogTreeItem | undefined
  > = new EventEmitter<ILogTreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<ILogTreeItem | undefined> = this
    ._onDidChangeTreeData.event;

  private currentItem?: ICachedLog;

  constructor(private model: Model) {
    window.onDidChangeActiveTextEditor(this.editorChanged, this);
    commands.registerCommand(
      "svn.itemlog.openFileRemote",
      this.openFileRemoteCmd,
      this
    );
    commands.registerCommand("svn.itemlog.openDiff", this.openDiffCmd, this);
    commands.registerCommand(
      "svn.itemlog.openDiffBase",
      this.openDiffBaseCmd,
      this
    );
    commands.registerCommand("svn.itemlog.refresh", this.refresh, this);
    this.refresh();
  }

  public async openFileRemoteCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntry;
    const item = unwrap(this.currentItem);
    return openFileRemote(item.repo, item.svnTarget, commit.revision);
  }

  public async openDiffBaseCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntry;
    const item = unwrap(this.currentItem);
    return openDiff(item.repo, item.svnTarget, commit.revision, "BASE");
  }

  public async openDiffCmd(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntry;
    const item = unwrap(this.currentItem);
    const pos = item.entries.findIndex(e => e === commit);
    if (pos === item.entries.length - 1) {
      window.showWarningMessage("Cannot diff last commit");
      return;
    }
    const prevRev = item.entries[pos + 1].revision;
    return openDiff(item.repo, item.svnTarget, prevRev, commit.revision);
  }

  public async editorChanged(te?: TextEditor) {
    return this.refresh(undefined, te);
  }

  public async refresh(
    element?: ILogTreeItem,
    te?: TextEditor,
    loadMore?: boolean
  ) {
    // TODO maybe make autorefresh optionable?
    if (loadMore) {
      await fetchMore(unwrap(this.currentItem));
      this._onDidChangeTreeData.fire(element);
      return;
    }

    if (te === undefined) {
      te = window.activeTextEditor;
    }
    if (te) {
      const uri = te.document.uri;
      if (uri.scheme === "file") {
        if (uri.path.startsWith(tempdir)) {
          return; // do not refresh if diff was called
        }
        const repo = this.model.getRepository(uri);
        if (repo !== undefined) {
          try {
            const info = await repo.getInfo(uri.path);
            this.currentItem = {
              isComplete: false,
              entries: [],
              repo,
              svnTarget: Uri.parse(info.url),
              persisted: {
                commitFrom: "HEAD",
                baseRevision: parseInt(info.revision, 10)
              },
              order: 0
            };
          } catch (e) {
            // doesn't belong to this repo
          }
        }
      }
      this._onDidChangeTreeData.fire(element);
    }
  }

  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    let ti: TreeItem;
    if (element.kind === LogTreeItemKind.Commit) {
      const cached = unwrap(this.currentItem);
      const commit = element.data as ISvnLogEntry;
      ti = new TreeItem(getCommitLabel(commit), TreeItemCollapsibleState.None);
      ti.iconPath = getCommitIcon(commit.author);
      ti.tooltip = getCommitToolTip(commit);
      ti.contextValue = "diffable";
      ti.command = {
        command: "svn.itemlog.openDiff",
        title: "Open diff",
        arguments: [element]
      };
    } else if (element.kind === LogTreeItemKind.Action) {
      ti = element.data as TreeItem;
    } else {
      throw new Error("Shouldn't happen");
    }
    return ti;
  }

  public async getChildren(
    element: ILogTreeItem | undefined
  ): Promise<ILogTreeItem[]> {
    if (element === undefined) {
      if (this.currentItem === undefined) {
        return [];
      }
      const entries = this.currentItem.entries;
      if (entries.length === 0) {
        await fetchMore(this.currentItem);
      }
      const result = transform(entries, LogTreeItemKind.Commit);
      insertBaseMarker(this.currentItem, entries, result);
      if (!this.currentItem.isComplete) {
        const ti = new TreeItem(`Load another ${getLimit()} revisions`);
        const ltItem: ILogTreeItem = {
          kind: LogTreeItemKind.Action,
          data: ti
        };
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.itemlog.refresh",
          arguments: [element, undefined, true],
          title: "refresh element"
        };
        ti.iconPath = getIconObject("icon-unfold");
        result.push(ltItem);
      }
      return result;
    }
    return [];
  }
}
