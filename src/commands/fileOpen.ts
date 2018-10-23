import { commands, Uri } from "vscode";
import { Command } from "./command";

export class FileOpen extends Command {
  constructor() {
    super("svn.fileOpen");
  }

  public async execute(resourceUri: Uri) {
    await commands.executeCommand("vscode.open", resourceUri);
  }
}
