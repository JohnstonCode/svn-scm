import { QuickPickItem, SourceControlResourceGroup } from "vscode";

export default class ChangeListItem implements QuickPickItem {
  constructor(protected group: SourceControlResourceGroup) {}

  get label(): string {
    return this.group.id.replace(/^changelist-/, "");
  }

  get description(): string {
    return this.group.label;
  }
  get resourceGroup(): SourceControlResourceGroup {
    return this.group;
  }
}
