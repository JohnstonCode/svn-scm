import { SourceControlResourceState, window } from "vscode";
import { Model } from "../model";
import { Command } from "./command";

export class Remove extends Command {
  constructor(protected model: Model) {
    super("svn.remove", {}, model);
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    let keepLocal: boolean;
    const answer = await window.showWarningMessage(
      "Would you like to keep a local copy of the files?.",
      { modal: true },
      "Yes",
      "No"
    );

    if (!answer) {
      return;
    }

    if (answer === "Yes") {
      keepLocal = true;
    } else {
      keepLocal = false;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.removeFiles(paths, keepLocal);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to remove files");
      }
    });
  }
}
