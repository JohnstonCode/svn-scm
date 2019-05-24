import { Command } from "./command";
import { SourceControlResourceGroup, commands } from "vscode";

export class OpenResourceGroupFiles extends Command {
  constructor() {
    super("svn.openResourceGroupFiles");
  }

  public async execute(resourceGroup: SourceControlResourceGroup) {
    await commands.executeCommand(
      "svn.openFile",
      ...resourceGroup.resourceStates
    );
  }
}
