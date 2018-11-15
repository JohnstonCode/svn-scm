import * as fs from "fs";
import * as path from "path";
import { commands, TextDocumentShowOptions, Uri, window } from "vscode";
import { Repository } from "../repository";
import { dumpSvnFile } from "../tempFiles";
import { Command } from "./command";

function getLocalPath(repo: Repository, svnUri: Uri): Uri {
  const remotePath = svnUri.path;
  const repoRootRelative = path.relative(repo.remoteRoot.path, remotePath);
  const fromRepoToWS = path.relative(repo.root, repo.workspaceRoot);
  return Uri.file(
    path.join(repo.workspaceRoot, fromRepoToWS, repoRootRelative)
  );
}

export class OpenDiff extends Command {
  constructor() {
    super("svn.openDiff");
  }

  public async execute(repo: Repository, arg: Uri, r1: string, r2: string) {
    const getUri = async (revision: string): Promise<Uri> => {
      if (revision === "BASE") {
        const localPath = getLocalPath(repo, arg);
        if (!fs.existsSync(localPath.path)) {
          const errorMsg = "BASE revision doesn't exist for " + localPath.path;
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
    return commands.executeCommand<void>(
      "vscode.diff",
      uri1,
      uri2,
      `${arg.path} (${r1} : ${r2})`,
      opts
    );
  }
}
