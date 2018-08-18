import { QuickPickItem } from "vscode";

export default class ParentFolderItem implements QuickPickItem {
  constructor(public path?: string) {}

  get label(): string {
    return `$(arrow-left) back to /${this.path}`;
  }
  get description(): string {
    return `Back to parent`;
  }
}
