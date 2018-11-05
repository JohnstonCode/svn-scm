import * as path from "path";
import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri
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

function getIconUri(iconName: string, theme: string): Uri {
  const iconsRootPath = path.join(__dirname, "..", "..", "icons");
  return Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}

function getActionIcon(action: string) {
  let name: string | undefined;
  switch (action) {
    case "A":
      name = "status-added";
      break;
    case "D":
      name = "status-deleted";
      break;
    case "M":
      name = "status-modified";
      break;
    case "R":
      name = "status-renamed";
      break;
  }
  if (name === undefined) {
    return undefined;
  }
  return {
    light: getIconUri(name, "light"),
    dark: getIconUri(name, "dark")
  };
}

export class LogProvider implements TreeDataProvider<ILogTreeItem> {
  private _onDidChangeTreeData: EventEmitter<
    ILogTreeItem | undefined
  > = new EventEmitter<ILogTreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<ILogTreeItem | undefined> = this
    ._onDidChangeTreeData.event;

  constructor(private model: Model) {}

  public refresh() {
    this._onDidChangeTreeData.fire();
  }

  public async getTreeItem(element: ILogTreeItem): Promise<TreeItem> {
    let ti: TreeItem;
    if (element.kind === LogTreeItemKind.Repo) {
      const repo = element.data as Repository;
      ti = new TreeItem(repo.root, TreeItemCollapsibleState.Collapsed);
      ti.iconPath = {
        light: getIconUri("icon-repo", "light"),
        dark: getIconUri("icon-repo", "dark")
      };
    } else if (element.kind === LogTreeItemKind.Commit) {
      const commit = element.data as ISvnLogEntry;
      ti = new TreeItem(commit.msg, TreeItemCollapsibleState.Collapsed);
      let date = commit.date;
      if (!isNaN(Date.parse(date))) {
        date = new Date(date).toString();
      }
      ti.tooltip = `Author ${commit.author} at ${date}`;
    } else if (element.kind === LogTreeItemKind.CommitDetail) {
      const pathElem = element.data as ISvnLogEntryPath;
      const basename = path.basename(pathElem._);
      ti = new TreeItem(basename, TreeItemCollapsibleState.None);
      ti.tooltip = path.dirname(pathElem._);
      ti.iconPath = getActionIcon(pathElem.action);
    } else {
      throw new Error("Unknown tree elem");
    }

    return ti;
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
