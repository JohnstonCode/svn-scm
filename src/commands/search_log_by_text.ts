import * as path from "path";
import { Command } from "./command";
import { window, Uri, commands } from "vscode";
import { Repository } from "../repository";
import { toSvnUri } from "../uri";
import { SvnUriAction } from "../common/types";

export class SearchLogByText extends Command {
  constructor() {
    super("svn.searchLogByText", { repository: true });
  }

  public async execute(repository: Repository) {
    const input = await window.showInputBox({ prompt: "Search query" });
    if (!input) {
      return;
    }

    try {
      const resource = toSvnUri(
        Uri.file(repository.workspaceRoot),
        SvnUriAction.LOG_SEARCH,
        { search: input }
      );
      const uri = resource.with({
        path: path.join(resource.path, "svn.log")
      });

      await commands.executeCommand<void>("vscode.open", uri);
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to log");
    }
  }
}
