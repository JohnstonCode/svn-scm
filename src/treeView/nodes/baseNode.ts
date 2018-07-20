import { TreeItem } from "vscode";

export default abstract class BaseNode {
  abstract getChildren(): BaseNode[] | Promise<BaseNode>;
  abstract getTreeItem(): TreeItem | Promise<TreeItem>;
}
