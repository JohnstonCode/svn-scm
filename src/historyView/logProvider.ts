import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState
} from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { configuration } from "../helpers/configuration";
import { Model } from "../model";
import { Repository } from "../repository";

enum LogTreeItemKind {
  Repo,
  Commit,
  CommitDetail,
  Action
}

interface ILogTreeItem {
  kind: LogTreeItemKind;
  data: ISvnLogEntry | ISvnLogEntryPath | Repository;
}

function transform(array: any[], kind: LogTreeItemKind): ILogTreeItem[] {
  return array.map(data => {
    return { kind, data };
  });
}

export class LogProvider implements TreeDataProvider<ILogTreeItem> {
  constructor(private model: Model) {}
  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    console.log(element);

    if (element.kind === LogTreeItemKind.Repo) {
      const repo = element.data as Repository;
      return new TreeItem(repo.root, TreeItemCollapsibleState.Collapsed);
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      return new TreeItem(commit.msg, TreeItemCollapsibleState.Collapsed);
    } else if (element.kind === LogTreeItemKind.CommitDetail) {
      const path = element.data as ISvnLogEntryPath;
      return new TreeItem(path._, TreeItemCollapsibleState.None);
    }

    throw new Error("shouldn't happen");
  }
  public async getChildren(
    element: ILogTreeItem | undefined
  ): Promise<ILogTreeItem[]> {
    if (element === undefined) {
      return transform(this.model.repositories, LogTreeItemKind.Repo);
    } else if (element.kind === LogTreeItemKind.Repo) {
      const limit = Number.parseInt(
        configuration.get<string>("log.length") || "50",
        10
      );
      if (isNaN(limit)) {
        throw new Error("Invalid log.length setting value");
      }
      const repo = element.data as Repository;
      const logentries = await repo.log2("HEAD", "1", limit);
      return transform(logentries, LogTreeItemKind.Commit);
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      return transform(commit.paths, LogTreeItemKind.CommitDetail);
    }
    return [];
  }
}
