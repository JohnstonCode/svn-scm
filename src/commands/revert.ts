import { SourceControlResourceState, window } from "vscode";
import { Command } from "./command";

export class Revert extends Command {
  constructor() {
    super("svn.revert");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0) {
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

    const uris = selection.map(resource => resource.resourceUri);

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
