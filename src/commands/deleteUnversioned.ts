import * as fs from "original-fs";
import { SourceControlResourceState, window } from "vscode";
import { exists } from "../fs/exists";
import { lstat } from "../fs/lstat";
import { unlink } from "../fs/unlink";
import { deleteDirectory } from "../util";
import { Command } from "./command";

export class DeleteUnversioned extends Command {
  constructor() {
    super("svn.deleteUnversioned");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);
    if (selection.length === 0) {
      return;
    }
    const uris = selection.map(resource => resource.resourceUri);
    const answer = await window.showWarningMessage(
      "Would you like to delete selected files?",
      { modal: true },
      "Yes",
      "No"
    );
    if (answer === "Yes") {
      for (const uri of uris) {
        const fsPath = uri.fsPath;

        try {
          if (!await exists(fsPath)) {
            continue;
          }

          const stat = await lstat(fsPath);

          if (stat.isDirectory()) {
            deleteDirectory(fsPath);
          } else {
            await unlink(fsPath);
          }
        } catch (err) {
          // TODO(cjohnston) Show meaningful error to user
        }
      }
    }
  }
}
