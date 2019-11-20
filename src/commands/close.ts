import { commands } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { Repository } from "../repository";
import { Command } from "./command";

export class Close extends Command {
  constructor() {
    super("svn.close", { repository: true });
  }

  public async execute(repository: Repository) {
    const sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    sourceControlManager.close(repository);
  }
}
