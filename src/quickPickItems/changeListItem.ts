import { QuickPickItem } from "vscode";
import { ISvnResourceGroup } from "../common/types";

export default class ChangeListItem implements QuickPickItem {
  constructor(protected group: ISvnResourceGroup) {}

  get label(): string {
    return this.group.id.replace(/^changelist-/, "");
  }

  get id(): string {
    return this.group.id;
  }

  get description(): string {
    return this.group.label;
  }
  get resourceGroup(): ISvnResourceGroup {
    return this.group;
  }
}
