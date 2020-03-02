import { Command } from "./command";
import { window, Uri, commands, ProgressLocation } from "vscode";
import { Repository } from "../repository";
import * as cp from "child_process";
import { tempSvnFs } from "../temp_svn_fs";
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class SearchLogByText extends Command {
  constructor() {
    super("svn.searchLogByText", { repository: true });
  }

  public async execute(repository: Repository) {
    const input = await window.showInputBox({ prompt: localize("searchText.search_query", "Search query") });
    if (!input) {
      return;
    }

    const uri = Uri.parse("tempsvnfs:/svn.log");
    tempSvnFs.writeFile(uri, Buffer.from(""), {
      create: true,
      overwrite: true
    });

    await commands.executeCommand<void>("vscode.open", uri);

    const proc = cp.spawn("svn", ["log", "--search", input], {
      cwd: repository.workspaceRoot
    });

    let content = "";

    proc.stdout.on("data", data => {
      content += data.toString();

      tempSvnFs.writeFile(uri, Buffer.from(content), {
        create: true,
        overwrite: true
      });
    });

    window.withProgress(
      {
        cancellable: true,
        location: ProgressLocation.Notification,
        title: localize("searchText.searching", "Searching Log")
      },
      (_progress, token) => {
        token.onCancellationRequested(() => {
          proc.kill("SIGINT");
        });

        return new Promise((resolve, reject) => {
          proc.on("exit", (code: number) => {
            code === 0 ? resolve() : reject();
          });
        });
      }
    );
  }
}
