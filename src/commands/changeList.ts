import { SourceControlResourceState, window } from "vscode";
import { inputSwitchChangelist } from "../changelistItems";
import { Model } from "../model";
import { Command } from "./command";

export class ChangeList extends Command {
  constructor(protected model: Model) {
    super("svn.changelist", {}, model);
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

      let canRemove = false;

      repository.changelists.forEach((group, changelist) => {
        if (
          group.resourceStates.some(state => {
            return resources.some(resource => {
              return resource.path === state.resourceUri.path;
            });
          })
        ) {
          console.log("canRemove true");
          canRemove = true;
          return false;
        }
      });

      const changelistName = await inputSwitchChangelist(repository, canRemove);

      if (!changelistName && changelistName !== false) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      if (changelistName === false) {
        try {
          await repository.removeChangelist(paths);
        } catch (error) {
          console.log(error);
          window.showErrorMessage(
            `Unable to remove file "${paths.join(",")}" from changelist`
          );
        }
      } else {
        try {
          await repository.addChangelist(paths, changelistName);
        } catch (error) {
          console.log(error);
          window.showErrorMessage(
            `Unable to add file "${paths.join(
              ","
            )}" to changelist "${changelistName}"`
          );
        }
      }
    });
  }
}
