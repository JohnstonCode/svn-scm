import { Command } from "./command";
import { SourceControlResourceGroup, commands } from "vscode";

export class OpenResourceGroupFilesAndCloseOthers extends Command {
  constructor() {
    super("svn.openResourceGroupFilesAndCloseOthers");
  }

  public async execute(resourceGroup: SourceControlResourceGroup) {
	await commands.executeCommand('workbench.action.closeAllEditors');
    await commands.executeCommand(
      "svn.openFile",
      ...resourceGroup.resourceStates
    );
  }
}