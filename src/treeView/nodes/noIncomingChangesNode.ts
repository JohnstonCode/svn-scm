import { TreeItem, TreeItemCollapsibleState } from "vscode";
import BaseNode from "./baseNode";

export default class NoIncomingChangesNode implements BaseNode {
  public getTreeItem(): TreeItem {
    const item = new TreeItem(
      "No Incoming Changes",
      TreeItemCollapsibleState.None
    );

    return item;
  }

  public async getChildren(): Promise<BaseNode[]> {
    return [];
  }
}
