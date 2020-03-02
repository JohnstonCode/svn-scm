import { SourceControlResourceState, window } from "vscode";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class Remove extends Command {
  constructor() {
    super("svn.remove");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    let keepLocal: boolean;
    const yes = localize("remove.yes", "Yes");
    const answer = await window.showWarningMessage(
      localize(
        "remove.keep_local_copy",
        "Would you like to keep a local copy of the files?"
      ),
      { modal: true },
      yes,
      localize("remove.no", "No")
    );

    if (!answer) {
      return;
    }

    if (answer === yes) {
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
        window.showErrorMessage(
          localize("remove.unable_to_remove", "Unable to remove files")
        );
      }
    });
  }
}
