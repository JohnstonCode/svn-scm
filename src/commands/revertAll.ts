import { SourceControlResourceGroup, window } from "vscode";
import { checkAndPromptDepth, confirmRevert } from "../input/revert";
import { Command } from "./command";
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class RevertAll extends Command {
  constructor() {
    super("svn.revertAll");
  }

  public async execute(resourceGroup: SourceControlResourceGroup) {
    const resourceStates = resourceGroup.resourceStates;

    if (resourceStates.length === 0 || !(await confirmRevert())) {
      return;
    }

    const uris = resourceStates.map(resource => resource.resourceUri);
    const depth = await checkAndPromptDepth(uris);

    if (!depth) {
      return;
    }

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.revert(paths, depth);
      } catch (error) {
        console.log(error);
        window.showErrorMessage(localize("revertAll.unable_to_revert", "Unable to revert"));
      }
    });
  }
}
