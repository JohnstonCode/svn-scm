import { SourceControlResourceGroup, window } from "vscode";
import { Command } from "./command";
import { SvnDepth } from "../common/types";

export class RevertAll extends Command {
  constructor() {
    super("svn.revertAll");
  }

  public async execute(resourceGroup: SourceControlResourceGroup) {
    const resourceStates = resourceGroup.resourceStates;

    if (resourceStates.length === 0) {
      return;
    }

    const yes = "Yes I'm sure";
    const answer = await window.showWarningMessage(
      "Are you sure? This will wipe all local changes.",
      { modal: true },
      yes
    );

    if (answer !== yes) {
      return;
    }

    const picks: any[] = [];

    for (let depth in SvnDepth) {
      picks.push({ label: depth, description: SvnDepth[depth] });
    }

    const placeHolder = "Select revert depth";
    const pick = await window.showQuickPick(picks, { placeHolder });
    const uris = resourceStates.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.revert(paths, pick.label);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to revert");
      }
    });
  }
}
