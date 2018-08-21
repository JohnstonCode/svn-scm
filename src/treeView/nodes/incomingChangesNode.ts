import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { Repository } from "../../repository";
import { getIconUri } from "../../uri";
import BaseNode from "./baseNode";
import IncommingChangeNode from "./incomingChangeNode";
import NoIncomingChangesNode from "./noIncomingChangesNode";

export default class IncomingChangesNode implements BaseNode {
  constructor(private repository: Repository) {}

  public getTreeItem(): TreeItem {
    const item = new TreeItem(
      "Incoming Changes",
      TreeItemCollapsibleState.Collapsed
    );
    item.iconPath = {
      dark: getIconUri("download", "dark"),
      light: getIconUri("download", "light")
    };

    return item;
  }

  public async getChildren(): Promise<BaseNode[]> {
    if (!this.repository.remoteChanges) {
      return [];
    }

    const changes = this.repository.remoteChanges.map(remoteChange => {
      return new IncommingChangeNode(
        remoteChange.resourceUri,
        remoteChange.type,
        this.repository
      );
    });

    if (changes.length === 0) {
      return [new NoIncomingChangesNode()];
    }

    return changes;
  }
}
