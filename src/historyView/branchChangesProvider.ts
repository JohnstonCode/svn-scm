import {
  TreeDataProvider,
  Disposable,
  TreeItem,
  commands,
  EventEmitter,
  window
} from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { ISvnPathChange, Status } from "../common/types";
import { openDiff, getIconObject, openFileRemote } from "./common";
import { dispose } from "../util";

export class BranchChangesProvider
  implements TreeDataProvider<ISvnPathChange>, Disposable {
  private _dispose: Disposable[] = [];
  private _onDidChangeTreeData = new EventEmitter<ISvnPathChange | undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private model: SourceControlManager) {
    this._dispose.push(
      window.registerTreeDataProvider("branchchanges", this),
      commands.registerCommand(
        "svn.branchchanges.openDiff",
        this.openDiffCmd,
        this
      ),
      commands.registerCommand(
        "svn.branchchanges.refresh",
        () => this._onDidChangeTreeData.fire(undefined),
        this
      ),
      this.model.onDidChangeRepository(() =>
        this._onDidChangeTreeData.fire(undefined)
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
      label: element.localPath.fsPath,
      command: {
        command: "svn.branchchanges.openDiff",
        title: "Open diff",
        arguments: [element]
      },
      iconPath,
      tooltip: `${element.oldPath.fsPath.replace(element.repo.fsPath, "")}@r${
        element.oldRevision
      } → ${element.newPath.fsPath.replace(element.repo.fsPath, "")}@r${
        element.newRevision
      }`
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
    if (element.item === Status.ADDED) {
      return openFileRemote(repo, element.newPath, element.newRevision);
    }
  }
}
