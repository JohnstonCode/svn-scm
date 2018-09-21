import * as path from "path";
import { Uri, window } from "vscode";
import { Model } from "../model";
import { Repository } from "../repository";
import { fixPathSeparator } from "../util";
import { Command } from "./command";

export class RenameExplorer extends Command {
  constructor(protected model: Model) {
    super("svn.renameExplorer", { repository: true }, model);
  }

  public async execute(repository: Repository, mainUri?: Uri, allUris?: Uri[]) {
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
        prompt: `New name name for ${oldName}`
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
