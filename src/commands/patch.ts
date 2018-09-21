import { SourceControlResourceState } from "vscode";
import { Model } from "../model";
import { Command } from "./command";

export class Patch extends Command {
  constructor(protected model: Model) {
    super("svn.patch", {}, model);
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = this.getResourceStates(resourceStates);

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
