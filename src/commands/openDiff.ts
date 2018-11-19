import * as fs from "fs";
import * as path from "path";
import { commands, TextDocumentShowOptions, Uri, window } from "vscode";
import { Repository } from "../repository";
import { dumpSvnFile } from "../tempFiles";
import { Command } from "./command";

/** svn://mysvn.org/repox/trunk/f1 -> file:///home/u/trunk/f1 */
export function getLocalPath(repo: Repository, svnUri: Uri): Uri {
  const remotePath = svnUri.path;
  const repoRoot = Uri.parse(repo.info.repository.root);
  const pathFromRepoRoot = path.relative(repoRoot.path, remotePath);
  const wcRepoRelative = path.relative(
    repo.info.relativeUrl.substr(1),
    "/" + pathFromRepoRoot
  );
  const fromRepoToWS = path.relative(repo.workspaceRoot, repo.root);
  return Uri.file(path.join(repo.workspaceRoot, fromRepoToWS, wcRepoRelative));
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
