import { SourceControlResourceState, window } from "vscode";
import { getConflictPickOptions } from "../conflictItems";
import { Model } from "../model";
import { Command } from "./command";

export class Resolve extends Command {
  constructor(protected model: Model) {
    super("svn.resolve", {}, model);
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }
    const picks = getConflictPickOptions();

    const choice = await window.showQuickPick(picks, {
      placeHolder: "Select conflict option"
    });

    if (!choice) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const files = resources.map(resource => resource.fsPath);

      await repository.resolve(files, choice.label);
    });
  }
}
