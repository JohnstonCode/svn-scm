import { Command } from "./command";
import { window, Uri, commands, ProgressLocation } from "vscode";
import { Repository } from "../repository";
import * as cp from "child_process";
import { svnFs } from "../svn_fs";

export class SearchLogByText extends Command {
  constructor() {
    super("svn.searchLogByText", { repository: true });
  }

  public async execute(repository: Repository) {
    const input = await window.showInputBox({ prompt: "Search query" });
    if (!input) {
      return;
    }

    const uri = Uri.parse("svnfs:/svn.log");
    svnFs.writeFile(uri, Buffer.from(""), {
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

      svnFs.writeFile(uri, Buffer.from(content), {
        create: true,
        overwrite: true
      });
    });

    window.withProgress(
      {
        cancellable: true,
        location: ProgressLocation.Notification,
        title: "Searching Log"
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
