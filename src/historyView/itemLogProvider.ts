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
  getIconObject,
  getLimit,
  ICachedLog,
  ILogTreeItem,
  LogTreeItemKind,
  svnFullPathToUri,
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
      this.openFileRemote,
      this
    );
    commands.registerCommand("svn.itemlog.openDiff", this.openDiff, this);
    commands.registerCommand(
      "svn.itemlog.openDiffBase",
      this.openDiffBase,
      this
    );
    commands.registerCommand("svn.itemlog.refresh", this.refresh, this);
    this.refresh();
  }

  public openFileRemote(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntry;
    const item = unwrap(this.currentItem);
    commands.executeCommand(
      "svn.openFileRemote",
      item.repo,
      item.svnTarget,
      commit.revision
    );
  }

  public openDiffBase(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntry;
    const item = unwrap(this.currentItem);
    commands.executeCommand(
      "svn.openDiff",
      item.repo,
      item.svnTarget,
      commit.revision,
      "BASE"
    );
  }

  public openDiff(element: ILogTreeItem) {
    const commit = element.data as ISvnLogEntry;
    const item = unwrap(this.currentItem);
    const pos = item.entries.findIndex(e => e === commit);
    if (pos === item.entries.length - 1) {
      window.showWarningMessage("Cannot diff last commit");
      return;
    }
    const prevRev = item.entries[pos + 1].revision;
    commands.executeCommand(
      "svn.openDiff",
      item.repo,
      item.svnTarget,
      commit.revision,
      prevRev
    );
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
                commitFrom: info.revision
              }
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
      if (this.currentItem.entries.length === 0) {
        await fetchMore(this.currentItem);
      }
      const result = transform(
        this.currentItem.entries,
        LogTreeItemKind.Commit
      );
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
