import { TreeItem, TreeItemCollapsibleState } from "vscode";
import BaseNode from "./baseNode";
import { getIconUri } from "../../uri";
import IncommingChangeNode from "./incomingChangeNode";
import { Repository } from "../../repository";
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
    const changes = this.repository.remoteChanges.map(remoteChange => {
      return new IncommingChangeNode(
        remoteChange.uri,
        remoteChange.type,
        remoteChange.props
      );
    });

    if (changes.length === 0) {
      return [new NoIncomingChangesNode()];
    }

    return changes;
  }
}
