import { SourceControlResourceState, window } from "vscode";
import { Command } from "./command";

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
        window.showErrorMessage("Unable to add file");
      }
    });
  }
}
