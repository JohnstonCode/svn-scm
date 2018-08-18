import { QuickPickItem } from "vscode";

export default class NewFolderItem implements QuickPickItem {
  constructor(protected _parent: string) {}

  get label(): string {
    return `$(plus) Create new branch`;
  }

  get description(): string {
    return `Create new branch in "${this._parent}"`;
  }
}
