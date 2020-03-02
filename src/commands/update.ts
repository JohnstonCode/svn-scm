import { window } from "vscode";
import { configuration } from "../helpers/configuration";
import { Repository } from "../repository";
import { Command } from "./command";
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class Update extends Command {
  constructor() {
    super("svn.update", { repository: true });
  }

  public async execute(repository: Repository) {
    try {
      const ignoreExternals = configuration.get<boolean>(
        "update.ignoreExternals",
        false
      );
      const showUpdateMessage = configuration.get<boolean>(
        "showUpdateMessage",
        true
      );

      const result = await repository.updateRevision(ignoreExternals);

      if (showUpdateMessage) {
        window.showInformationMessage(result);
      }
    } catch (error) {
      console.error(error);
      window.showErrorMessage(localize("update.unable", "Unable to update"));
    }
  }
}
