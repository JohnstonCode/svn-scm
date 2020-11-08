import { SourceControlResourceState, window } from "vscode";
import { checkAndPromptDepth, confirmRevert } from "../input/revert";
import { Command } from "./command";

export class Revert extends Command {
  constructor() {
    super("svn.revert");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0 || !(await confirmRevert())) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);
    const depth = await checkAndPromptDepth(uris);

    if (!depth) {
      return;
    }

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath).reverse();

      try {
        await repository.revert(paths, depth);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to revert");
      }
    });
  }
}
