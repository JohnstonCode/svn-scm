import * as path from "path";
import { SourceControlResourceState, Uri, window } from "vscode";
import { Status } from "../common/types";
import { configuration } from "../helpers/configuration";
import { executeHook } from "../helpers/hooks";
import { inputCommitMessage } from "../messages";
import { Resource } from "../resource";
import { Command } from "./command";

export class Commit extends Command {
  constructor() {
    super("svn.commit");
  }

  public async execute(...resources: SourceControlResourceState[]) {
    if (resources.length === 0 || !(resources[0].resourceUri instanceof Uri)) {
      const resource = await this.getSCMResource();

      if (!resource) {
        return;
      }

      resources = [resource];
    }

    const selection = resources.filter(
      s => s instanceof Resource
    ) as Resource[];

    const uris = selection.map(resource => resource.resourceUri);
    selection.forEach(resource => {
      if (resource.type === Status.ADDED && resource.renameResourceUri) {
        uris.push(resource.renameResourceUri);
      }
    });

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      for (const resource of resources) {
        let dir = path.dirname(resource.fsPath);
        let parent = repository.getResourceFromFile(dir);

        while (parent) {
          if (parent.type === Status.ADDED) {
            paths.push(dir);
          }
          dir = path.dirname(dir);
          parent = repository.getResourceFromFile(dir);
        }
      }

      try {
        const message = await inputCommitMessage(
          repository.inputBox.value,
          true,
          paths
        );

        if (message === undefined) {
          return;
        }

        repository.inputBox.value = message;

        const prehook = configuration.get<string>("hooks.precommit");
        if (prehook) {
          await executeHook(prehook);
        }

        const result = await repository.commitFiles(message, paths);
        window.showInformationMessage(result);
        repository.inputBox.value = "";

        const posthook = configuration.get<string>("hooks.postcommit");
        if (posthook) {
          await executeHook(prehook);
        }
      } catch (error) {
        console.error(error);
        window.showErrorMessage(error.stderrFormated);
      }
    });
  }
}
