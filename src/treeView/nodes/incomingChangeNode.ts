import * as fs from "fs";
import * as path from "path";
import { TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { getIconUri } from "../../uri";
import BaseNode from "./baseNode";

export default class IncomingChangeNode implements BaseNode {
  constructor(public uri: Uri, public type: string) {}

  get props(): undefined {
    return undefined;
  }

  get label() {
    return path.basename(this.uri.path);
  }

  public getTreeItem(): TreeItem {
    const item = new TreeItem(this.label, TreeItemCollapsibleState.None);
    item.iconPath = {
      dark: getIconUri(`status-${this.type}`, "dark"),
      light: getIconUri(`status-${this.type}`, "light")
    };
    item.contextValue = this.getContextValue();

    return item;
  }

  public getChildren(): Promise<BaseNode[]> {
    return Promise.resolve([]);
  }

  private getContextValue(): string {
    return `incomingChange:file:${this.type}`;
  }
}
