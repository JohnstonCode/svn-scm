import {
  commands,
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem
} from "vscode";
import { SourceControlManager } from "../../source_control_manager";
import BaseNode from "../nodes/baseNode";
import RepositoryNode from "../nodes/repositoryNode";

export default class SvnProvider implements TreeDataProvider<BaseNode> {
  private _onDidChangeTreeData: EventEmitter<
    BaseNode | undefined
  > = new EventEmitter<BaseNode | undefined>();
  public onDidChangeTreeData: Event<BaseNode | undefined> = this
    ._onDidChangeTreeData.event;

  constructor(private sourceControlManager: SourceControlManager) {
    commands.registerCommand("svn.treeview.refreshProvider", () =>
      this.refresh()
    );
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: RepositoryNode): TreeItem {
    return element.getTreeItem();
  }

  public async getChildren(element?: BaseNode): Promise<BaseNode[]> {
    if (
      !this.sourceControlManager ||
      this.sourceControlManager.openRepositories.length === 0
    ) {
      return Promise.resolve([]);
    }

    if (element) {
      return element.getChildren();
    }

    const repositories = this.sourceControlManager.openRepositories.map(
      repository => {
        return new RepositoryNode(repository.repository, this);
      }
    );

    return repositories;
  }

  public update(node: BaseNode): void {
    this._onDidChangeTreeData.fire(node);
  }
}
