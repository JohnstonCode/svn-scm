import { Uri, window } from "vscode";
import { checkAndPromptDepth, confirmRevert } from "../input/revert";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class RevertExplorer extends Command {
  constructor() {
    super("svn.revertExplorer");
  }

  public async execute(_mainUri?: Uri, allUris?: Uri[]) {
    if (!allUris) {
      return;
    }

    const uris = allUris;
    if (uris.length === 0 || !(await confirmRevert())) {
      return;
    }

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
        window.showErrorMessage(
          localize("revertExplorer.unable_to_revert", "Unable to revert")
        );
      }
    });
  }
}
