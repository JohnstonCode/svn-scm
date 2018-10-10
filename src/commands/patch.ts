import { SourceControlResourceState } from "vscode";
import { Command } from "./command";

export class Patch extends Command {
  constructor() {
    super("svn.patch");
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

      const files = resources.map(resource => resource.fsPath);
      const content = await repository.patch(files);
      await this.showDiffPath(repository, content);
    });
  }
}
