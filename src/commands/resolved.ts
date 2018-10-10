import * as path from "path";
import { Uri, window } from "vscode";
import { configuration } from "../helpers/configuration";
import { Command } from "./command";

export class Resolved extends Command {
  constructor() {
    super("svn.resolved");
  }

  public async execute(uri: Uri) {
    if (!uri) {
      return;
    }

    const autoResolve = configuration.get<boolean>("conflict.autoResolve");

    if (!autoResolve) {
      const basename = path.basename(uri.fsPath);
      const pick = await window.showWarningMessage(
        `Mark the conflict as resolved for "${basename}"?`,
        { modal: true },
        "Yes",
        "No"
      );

      if (pick !== "Yes") {
        return;
      }
    }

    const uris = [uri];

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const files = resources.map(resource => resource.fsPath);

      await repository.resolve(files, "working");
    });
  }
}
