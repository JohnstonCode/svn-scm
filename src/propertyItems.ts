import { QuickPickItem } from "vscode";
import { Repository } from "./repository";

export class IgnorePropertyItem implements QuickPickItem {
  get label(): string {
    return "Ignore";
  }

  get description(): string {
    return "Test";
  }

  async run(repository: Repository, filePath: string) {
    return repository.ignore(filePath);
  }
}
