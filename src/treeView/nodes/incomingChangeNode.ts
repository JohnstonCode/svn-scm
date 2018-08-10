import { TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import BaseNode from "./baseNode";
import * as path from "path";
import { getIconUri } from "../../uri";

export default class IncomingChangeNode implements BaseNode {
  constructor(private uri: Uri, private type: string, private props: string) {}

  get label() {
    return path.basename(this.uri.path);
  }

  public getTreeItem(): TreeItem {
    const item = new TreeItem(this.label, TreeItemCollapsibleState.None);
    item.iconPath = {
      dark: getIconUri(`status-${this.type}`, "dark"),
      light: getIconUri(`status-${this.type}`, "light")
    };

    return item;
  }

  public getChildren(): Promise<BaseNode[]> {
    return Promise.resolve([]);
  }
}
