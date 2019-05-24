import * as path from "path";
import { TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { Repository } from "../../repository";
import { Resource } from "../../resource";
import { getIconUri } from "../../uri";
import BaseNode from "./baseNode";

export default class IncomingChangeNode implements BaseNode {
  constructor(
    public uri: Uri,
    public type: string,
    public repository: Repository
  ) {}

  get props(): undefined {
    return undefined;
  }

  get label() {
    return path.relative(this.repository.workspaceRoot, this.uri.fsPath);
  }

  get contextValue() {
    return `incomingChange:${this.type}`;
  }

  public getTreeItem(): TreeItem {
    const item = new TreeItem(this.label, TreeItemCollapsibleState.None);
    item.iconPath = {
      dark: getIconUri(`status-${this.type}`, "dark"),
      light: getIconUri(`status-${this.type}`, "light")
    };
    item.contextValue = this.contextValue;
    item.command = this.getCommand();

    return item;
  }

  public getChildren(): Promise<BaseNode[]> {
    return Promise.resolve([]);
  }

  public getCommand() {
    switch (this.type) {
      case "modified":
        return {
          command: "svn.openChangeHead",
          title: "Open Changes with HEAD",
          arguments: [this.uri]
        };
      case "deleted":
        return {
          command: "svn.openFile",
          title: "Open File",
          arguments: [this.uri]
        };
      case "added":
        return {
          command: "svn.openHEADFile",
          title: "Open File (HEAD)",
          arguments: [
            new Resource(this.uri, this.type, undefined, "none", true)
          ]
        };
      default:
        console.error(`No command returned for type ${this.type}`);
        return;
    }
  }
}
