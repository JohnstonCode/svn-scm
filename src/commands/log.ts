import * as path from "path";
import { commands, Uri, window } from "vscode";
import { SvnUriAction } from "../common/types";
import { Repository } from "../repository";
import { toSvnUri } from "../uri";
import { Command } from "./command";
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class Log extends Command {
  constructor() {
    super("svn.log", { repository: true });
  }

  public async execute(repository: Repository) {
    try {
      const resource = toSvnUri(
        Uri.file(repository.workspaceRoot),
        SvnUriAction.LOG
      );
      const uri = resource.with({
        path: path.join(resource.path, "svn.log") // change document title
      });

      await commands.executeCommand<void>("vscode.open", uri);
    } catch (error) {
      console.error(error);
      window.showErrorMessage(localize("log.unable_to_log", "Unable to log"));
    }
  }
}
