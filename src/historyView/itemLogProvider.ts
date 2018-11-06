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
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { Model } from "../model";
import { Repository } from "../repository";
import { getCommitLabel, getGravatarUri, getLimit } from "./common";

type IItem = ISvnLogEntry;

export class ItemLogProvider implements TreeDataProvider<IItem> {
  private _onDidChangeTreeData: EventEmitter<
    IItem | undefined
  > = new EventEmitter<IItem | undefined>();
  public readonly onDidChangeTreeData: Event<IItem | undefined> = this
    ._onDidChangeTreeData.event;

  private logentries: IItem[] = [];
  private target?: string;
  private isComplete: boolean = false;
  private repo: Repository;

  constructor(private model: Model) {
    window.onDidChangeActiveTextEditor(this.editorChanged, this);
    this.editorChanged();
    this.repo = model.repositories[0]; // FIXME
  }

  public async refresh(element?: IItem) {
    this._onDidChangeTreeData.fire(element);
  }

  private editorChanged() {
    this.target = undefined;
    this.logentries = [];
    this.isComplete = false;
    const te = window.activeTextEditor;
    if (te) {
      const uri = te.document.uri;
      if (uri.scheme === "file") {
        this.target = uri.path;
      }
    }
    this.refresh();
  }

  private async fetchMore() {
    let rfrom = "HEAD";
    if (this.logentries.length) {
      rfrom = this.logentries[this.logentries.length - 1].revision;
      rfrom = (Number.parseInt(rfrom, 10) - 1).toString();
    }
    const moreCommits = await this.repo.log2(rfrom, "1", getLimit());
    this.logentries.push(...moreCommits);
    if (
      moreCommits.length === 0 ||
      moreCommits[moreCommits.length - 1].revision === "1"
    ) {
      this.isComplete = true;
    }
  }

  public async getTreeItem(element: IItem): Promise<TreeItem> {
    const ti = new TreeItem(
      getCommitLabel(element),
      TreeItemCollapsibleState.None
    );
    ti.iconPath = getGravatarUri(element.author);
    return ti;
  }

  public async getChildren(element: IItem | undefined): Promise<IItem[]> {
    if (element === undefined) {
      if (this.target === undefined) {
        return [];
      }
      await this.fetchMore();
      return Array.from(this.logentries); // FIXME
    }
    return [];
  }
}
