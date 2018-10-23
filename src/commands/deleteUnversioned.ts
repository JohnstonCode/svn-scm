import * as fs from "fs";
import { SourceControlResourceState, window } from "vscode";
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
      "Would you like delete the files?.",
      { modal: true },
      "Yes",
      "No"
    );
    if (answer === "Yes") {
      for (const uri of uris) {
        const fsPath = uri.fsPath;

        if (!fs.existsSync(fsPath)) {
          continue;
        }

        const stat = fs.lstatSync(fsPath);

        if (stat.isDirectory()) {
          deleteDirectory(fsPath);
        } else {
          fs.unlinkSync(fsPath);
        }
      }
    }
  }
}
