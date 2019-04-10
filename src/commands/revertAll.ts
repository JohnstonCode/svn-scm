import { SourceControlResourceGroup, window } from "vscode";
import { Command } from "./command";

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

    const uris = resourceStates.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.revert(paths);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to revert");
      }
    });
  }
}
