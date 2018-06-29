import { QuickPickItem } from "vscode";

export default class RemoveChangeListItem implements QuickPickItem {
  get label(): string {
    return "$(dash) Remove changelist";
  }

  get description(): string {
    return "Remove changelist of file(s)";
  }
}
