import * as fs from "fs";
import * as path from "path";
import { commands, TextDocumentShowOptions, Uri, window } from "vscode";
import { IRemoteRepository } from "../remoteRepository";
import { dumpSvnFile } from "../tempFiles";
import { Command } from "./command";

export class OpenDiff extends Command {
  constructor() {
    super("svn.openDiff");
  }

  public async execute(
    repo: IRemoteRepository,
    arg: Uri,
    r1: string,
    r2: string
  ) {
    const getUri = async (revision: string): Promise<Uri> => {
      if (revision === "BASE") {
        const nm = repo.getPathNormalizer();
        const ri = nm.parse(arg.toString());
        const localPath = ri.localFullPath;
        if (localPath === undefined || !fs.existsSync(localPath.path)) {
          const errorMsg =
            "BASE revision doesn't exist for " +
            (localPath ? localPath.path : "remote path");
          window.showErrorMessage(errorMsg);
          throw new Error(errorMsg);
        }
        return localPath;
      }
      const out = await repo.show(arg, revision);
      return dumpSvnFile(arg, revision, out);
    };
    const uri1 = await getUri(r1);
    const uri2 = await getUri(r2);
    const opts: TextDocumentShowOptions = {
      preview: true
    };
    const title = `${path.basename(arg.path)} (${r1} : ${r2})`;
    return commands.executeCommand<void>(
      "vscode.diff",
      uri1,
      uri2,
      title,
      opts
    );
  }
}
