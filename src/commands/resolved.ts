import * as path from "path";
import { Uri, window } from "vscode";
import { configuration } from "../helpers/configuration";
import { Command } from "./command";
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

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
      const yes = localize("resolved.yes", "Yes");
      const pick = await window.showWarningMessage(
        localize("resolved.mark_resolved", "Mark the conflict as resolved for '{0}'", basename),
        { modal: true },
        yes,
        localize("resolved.no", "No")
      );

      if (pick !== yes) {
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
