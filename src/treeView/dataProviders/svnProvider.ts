import {
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  window
} from "vscode";
import { Model } from "../../model";
import RepositoryNode from "../nodes/repositoryNode";

export default class SvnProvider implements TreeDataProvider<RepositoryNode> {
  constructor(private model: Model) {}

  public getTreeItem(element: RepositoryNode): TreeItem {
    return element.getTreeItem();
  }

  public getChildren(element?: RepositoryNode): Thenable<RepositoryNode[]> {
    if (!this.model || this.model.openRepositories.length === 0) {
      window.showInformationMessage("No Svn repositories open");
      return Promise.resolve([]);
    }

    return new Promise(resolve => {
      if (element) {
        resolve([]);
      }

      const repositories = this.model.openRepositories.map(repository => {
        return new RepositoryNode(repository.repository.workspaceRoot);
      });

      resolve(repositories);
    });
  }
}
