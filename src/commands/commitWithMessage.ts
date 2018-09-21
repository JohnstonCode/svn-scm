import * as path from "path";
import { window } from "vscode";
import { inputCommitChangelist } from "../changelistItems";
import { Status } from "../common/types";
import { inputCommitMessage } from "../messages";
import { Model } from "../model";
import { Repository } from "../repository";
import { Resource } from "../resource";
import { Command } from "./command";

export class CommitWithMessage extends Command {
  constructor(protected model: Model) {
    super("svn.commitWithMessage", { repository: true }, model);
  }

  public async execute(repository: Repository) {
    const choice = await inputCommitChangelist(repository);
    if (!choice) {
      return;
    }

    const message = await inputCommitMessage(repository.inputBox.value, false);
    if (message === undefined) {
      return;
    }

    const filePaths = choice.resourceGroup.resourceStates.map(state => {
      return state.resourceUri.fsPath;
    });

    // If files is renamed, the commit need previous file
    choice.resourceGroup.resourceStates.forEach(state => {
      if (state instanceof Resource) {
        if (state.type === Status.ADDED && state.renameResourceUri) {
          filePaths.push(state.renameResourceUri.fsPath);
        }

        let dir = path.dirname(state.resourceUri.fsPath);
        let parent = repository.getResourceFromFile(dir);

        while (parent) {
          if (parent.type === Status.ADDED) {
            filePaths.push(dir);
          }
          dir = path.dirname(dir);
          parent = repository.getResourceFromFile(dir);
        }
      }
    });

    try {
      const result = await repository.commitFiles(message, filePaths);
      window.showInformationMessage(result);
      repository.inputBox.value = "";
    } catch (error) {
      console.error(error);
      window.showErrorMessage(error.stderrFormated);
    }
  }
}
