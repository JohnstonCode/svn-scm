import * as path from "path";
import {
  Event,
  EventEmitter,
  TextEditor,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  window
} from "vscode";
import { ISvnLogEntry } from "../common/types";
import { Model } from "../model";
import { Repository } from "../repository";
import {
  getCommitLabel,
  getGravatarUri,
  getIconObject,
  getLimit,
  ILogTreeItem,
  LogTreeItemKind,
  needFetch,
  transform
} from "./common";

interface IItem {
  logentries: ISvnLogEntry[];
  target: string;
  isComplete: boolean;
  repo: Repository;
}

export class ItemLogProvider implements TreeDataProvider<ILogTreeItem> {
  private _onDidChangeTreeData: EventEmitter<
    ILogTreeItem | undefined
  > = new EventEmitter<ILogTreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<ILogTreeItem | undefined> = this
    ._onDidChangeTreeData.event;

  private currentItem?: IItem;

  constructor(private model: Model) {
    window.onDidChangeActiveTextEditor(this.editorChanged, this);
    this.refresh();
  }

  public async editorChanged(te?: TextEditor) {
    return this.refresh(undefined, te);
  }

  public async refresh(
    element?: ILogTreeItem,
    te?: TextEditor,
    loadMore?: boolean
  ) {
    let currentTarget: string | undefined;
    if (this.currentItem) {
      currentTarget = this.currentItem.target;
    }

    if (loadMore) {
      await this.fetchMore();
      this._onDidChangeTreeData.fire(element);
      return;
    }

    this.currentItem = undefined;
    if (te === undefined) {
      te = window.activeTextEditor;
    }
    if (te) {
      const uri = te.document.uri;
      if (uri.scheme === "file") {
        const repo = this.model.getRepository(uri);
        if (repo !== undefined) {
          try {
            await repo.getInfo(uri.path);
          } catch (e) {
            // doesn't belong to this repo
          }
          this.currentItem = {
            isComplete: false,
            logentries: [],
            repo,
            target: uri.path
          };
        }
      }
    }
    this._onDidChangeTreeData.fire(element);
  }

  private async fetchMore() {
    if (this.currentItem === undefined) {
      return;
    }
    let rfrom = "HEAD";
    const currentItem = this.currentItem;
    const le = currentItem.logentries;
    if (le.length) {
      rfrom = le[le.length - 1].revision;
      rfrom = (Number.parseInt(rfrom, 10) - 1).toString();
    }
    const moreCommits = await currentItem.repo.log2(
      rfrom,
      "1",
      getLimit(),
      currentItem.target
    );
    if (!needFetch(le, moreCommits)) {
      currentItem.isComplete = true;
    }
    le.push(...moreCommits);
  }

  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    let ti: TreeItem;
    if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      ti = new TreeItem(getCommitLabel(commit), TreeItemCollapsibleState.None);
      ti.iconPath = getGravatarUri(commit.author);
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
      if (this.currentItem.logentries.length === 0) {
        await this.fetchMore();
      }
      const result = transform(
        this.currentItem.logentries,
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
