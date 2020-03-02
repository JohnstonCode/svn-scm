import { window } from "vscode";
import { getConflictPickOptions } from "../conflictItems";
import { Repository } from "../repository";
import { Command } from "./command";
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class ResolveAll extends Command {
  constructor() {
    super("svn.resolveAll", { repository: true });
  }

  public async execute(repository: Repository) {
    const conflicts = repository.conflicts.resourceStates;

    if (!conflicts.length) {
      window.showInformationMessage("No Conflicts");
    }

    for (const conflict of conflicts) {
      const placeHolder = localize("resolveAll.select_option", "Select conflict option for {0}", conflict.resourceUri.path);
      const picks = getConflictPickOptions();

      const choice = await window.showQuickPick(picks, { placeHolder });

      if (!choice) {
        return;
      }

      try {
        const response = await repository.resolve(
          [conflict.resourceUri.path],
          choice.label
        );
        window.showInformationMessage(response);
      } catch (error) {
        window.showErrorMessage(error.stderr);
      }
    }
  }
}
