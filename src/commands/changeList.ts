import { commands, Uri, window } from "vscode";
import { inputSwitchChangelist } from "../changelistItems";
import { Model } from "../model";
import { Resource } from "../resource";
import { normalizePath } from "../util";
import { Command } from "./command";

export class ChangeList extends Command {
  constructor() {
    super("svn.changelist");
  }

  public async execute(...args: any[]) {
    let uris: Uri[];

    if (args[0] instanceof Resource) {
      uris = (args as Resource[]).map(resource => resource.resourceUri);
    } else if (args[0] instanceof Uri) {
      uris = args[1] as Uri[];
    } else if (window.activeTextEditor) {
      uris = [window.activeTextEditor.document.uri];
    } else {
      console.error("Unhandled type for changelist command");
      return;
    }

    const model = (await commands.executeCommand("svn.getModel", "")) as Model;

    const promiseArray = uris.map(
      async uri => await model.getRepositoryFromUri(uri)
    );
    let repositories = await Promise.all(promiseArray);
    repositories = repositories.filter(repository => repository);

    if (repositories.length === 0) {
      window.showErrorMessage(
        "Files are not under version control and cannot be added to a change list"
      );
      return;
    }

    const uniqueRepositories = Array.from(new Set(repositories));

    if (uniqueRepositories.length !== 1) {
      window.showErrorMessage(
        "Unable to add files from different repositories to change list"
      );
      return;
    }

    if (repositories.length !== uris.length) {
      window.showErrorMessage(
        "Some Files are not under version control and cannot be added to a change list"
      );
      return;
    }

    const repository = repositories[0];

    if (!repository) {
      return;
    }

    const paths = uris.map(uri => uri.fsPath);
    let canRemove = false;

    repository.changelists.forEach((group, _changelist) => {
      if (
        group.resourceStates.some(state => {
          return paths.some(path => {
            return (
              normalizePath(path) === normalizePath(state.resourceUri.path)
            );
          });
        })
      ) {
        canRemove = true;
        return false;
      }

      return;
    });

    const changelistName = await inputSwitchChangelist(repository, canRemove);

    if (!changelistName && changelistName !== false) {
      return;
    }

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
        window.showInformationMessage(
          `Added files "${paths.join(",")}" to changelist "${changelistName}"`
        );
      } catch (error) {
        console.log(error);
        window.showErrorMessage(
          `Unable to add file "${paths.join(
            ","
          )}" to changelist "${changelistName}"`
        );
      }
    }
  }
}
