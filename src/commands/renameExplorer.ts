import * as path from "path";
import { Uri, window } from "vscode";
import { Repository } from "../repository";
import { fixPathSeparator } from "../util";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class RenameExplorer extends Command {
  constructor() {
    super("svn.renameExplorer", { repository: true });
  }

  public async execute(
    repository: Repository,
    mainUri?: Uri,
    _allUris?: Uri[]
  ) {
    if (!mainUri) {
      return;
    }

    const oldName = mainUri.fsPath;

    return this.rename(repository, oldName);
  }

  private async rename(
    repository: Repository,
    oldFile: string,
    newName?: string
  ) {
    oldFile = fixPathSeparator(oldFile);

    if (!newName) {
      const root = fixPathSeparator(repository.workspaceRoot);
      const oldName = path.relative(root, oldFile);
      newName = await window.showInputBox({
        value: path.basename(oldFile),
        prompt: localize(
          "renameExplorer.new_name",
          "New name name for {0}",
          oldName
        )
      });
    }
    if (!newName) {
      return;
    }

    const basepath = path.dirname(oldFile);
    newName = path.join(basepath, newName);

    await repository.rename(oldFile, newName);
  }
}
