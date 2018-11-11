import { commands, TextDocumentShowOptions, Uri } from "vscode";
import { Repository } from "../repository";
import { dumpSvnFile } from "../tempFiles";
import { Command } from "./command";

export class OpenDiff extends Command {
  constructor() {
    super("svn.openDiff");
  }

  public async execute(repo: Repository, arg: Uri, r1: string, r2: string) {
    const out1 = await repo.show(arg, r1);
    const uri1 = await dumpSvnFile(arg, r1, out1);
    const out2 = await repo.show(arg, r2);
    const uri2 = await dumpSvnFile(arg, r2, out2);
    const opts: TextDocumentShowOptions = {
      preview: true
    };
    return commands.executeCommand<void>(
      "vscode.diff",
      uri1,
      uri2,
      `${arg.path} (${r1} : ${r2})`,
      opts
    );
  }
}
