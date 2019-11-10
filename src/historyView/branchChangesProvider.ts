import {
  TreeDataProvider,
  Disposable,
  TreeItem,
  Event,
  commands
} from "vscode";
import { Model } from "../model";
import { ISvnPathChange, Status } from "../common/types";
import { openDiff, getIconObject } from "./common";
import { dispose } from "../util";

export class BranchChangesProvider
  implements TreeDataProvider<ISvnPathChange>, Disposable {
  private _dispose: Disposable[] = [];

  constructor(private model: Model) {
    this._dispose.push(
      commands.registerCommand(
        "svn.branchchanges.openDiff",
        this.openDiffCmd,
        this
      )
    );
  }

  dispose() {
    dispose(this._dispose);
  }

  getTreeItem(element: ISvnPathChange): TreeItem | Thenable<TreeItem> {
    let iconName: string = "";
    if (element.item === Status.ADDED) {
      iconName = "status-added";
    } else if (element.item === Status.DELETED) {
      iconName = "status-deleted";
    } else if (element.item === Status.MODIFIED) {
      iconName = "status-modified";
    }

    const iconPath = getIconObject(iconName);

    return {
      label: element.newPath.toString(),
      command: {
        command: "svn.branchchanges.openDiff",
        title: "Open diff",
        arguments: [element]
      },
      iconPath,
      tooltip: `${element.oldPath}@r${element.oldRevision} → ${element.newPath}@r${element.newRevision}`
    };
  }
  getChildren(element?: ISvnPathChange): Promise<ISvnPathChange[]> {
    if (element !== undefined) {
      return Promise.resolve([]);
    }

    const changes: Promise<ISvnPathChange[]>[] = [];

    for (const repo of this.model.repositories) {
      changes.push(repo.getChanges());
    }

    return Promise.all(changes).then(value =>
      value.reduce((prev, curr) => prev.concat(curr), [])
    );
  }

  public async openDiffCmd(element: ISvnPathChange) {
    const repo = await this.model.getRemoteRepository(element.repo);

    if (element.item === Status.MODIFIED) {
      return openDiff(
        repo,
        element.oldPath,
        element.oldRevision,
        element.newRevision,
        element.newPath
      );
    }
  }
}
