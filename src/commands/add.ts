import { SourceControlResourceState, window } from "vscode";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class Add extends Command {
  constructor() {
    super("svn.add");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.addFiles(paths);
      } catch (error) {
        console.log(error);
        window.showErrorMessage(
          localize("add.unable_to_add_file", "Unable to add file")
        );
      }
    });
  }
}
