import { window } from "vscode";
import { configuration } from "../helpers/configuration";
import { Model } from "../model";
import IncomingChangeNode from "../treeView/nodes/incomingChangeNode";
import { Command } from "./command";

export class PullIncommingChange extends Command {
  constructor(protected model: Model) {
    super("svn.treeview.pullIncomingChange", {}, model);
  }

  // TODO: clean this up
  public async execute(...changes: any[]) {
    const showUpdateMessage = configuration.get<boolean>(
      "showUpdateMessage",
      true
    );

    if (changes[0] instanceof IncomingChangeNode) {
      try {
        const incomingChange = changes[0];

        const result = await incomingChange.repository.pullIncomingChange(
          incomingChange.uri.fsPath
        );

        if (showUpdateMessage) {
          window.showInformationMessage(result);
        }
      } catch (error) {
        console.error(error);
        window.showErrorMessage("Unable to update");
      }

      return;
    }

    const uris = changes.map(change => change.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const files = resources.map(resource => resource.fsPath);

      files.forEach(async path => {
        const result = await repository.pullIncomingChange(path);

        if (showUpdateMessage) {
          window.showInformationMessage(result);
        }
      });
    });
  }
}
