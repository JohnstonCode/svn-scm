import { TreeItem } from "vscode";

export default abstract class BaseNode {
  public abstract getChildren(): BaseNode[] | Promise<BaseNode[]>;
  public abstract getTreeItem(): TreeItem | Promise<TreeItem>;
}
