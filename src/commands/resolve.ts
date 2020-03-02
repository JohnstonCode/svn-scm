import { SourceControlResourceState, window } from "vscode";
import { getConflictPickOptions } from "../conflictItems";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class Resolve extends Command {
  constructor() {
    super("svn.resolve");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }
    const picks = getConflictPickOptions();

    const choice = await window.showQuickPick(picks, {
      placeHolder: localize("resolve.select_option", "Select conflict option")
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
