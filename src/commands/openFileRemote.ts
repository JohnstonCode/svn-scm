import { commands, TextDocumentShowOptions, Uri, window } from "vscode";
import { IRemoteRepository } from "../remoteRepository";
import { dumpSvnFile } from "../tempFiles";
import { Command } from "./command";

export class OpenFileRemote extends Command {
  constructor() {
    super("svn.openFileRemote");
  }

  public async execute(repo: IRemoteRepository, arg: Uri, against: string) {
    let out;
    try {
      out = await repo.show(arg, against);
    } catch {
      window.showErrorMessage("Failed to open path");
      return;
    }
    const localUri = await dumpSvnFile(arg, against, out);
    const opts: TextDocumentShowOptions = {
      preview: true
    };
    return commands.executeCommand<void>("vscode.open", localUri, opts);
  }
}
