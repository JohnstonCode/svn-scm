import { QuickPickItem } from "vscode";

export default class NewChangeListItem implements QuickPickItem {
  get label(): string {
    return "$(plus) New changelist";
  }

  get description(): string {
    return "Create a new change list";
  }
}
