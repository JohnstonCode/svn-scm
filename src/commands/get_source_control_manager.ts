import { SourceControlManager } from "../source_control_manager";
import { Command } from "./command";

export class GetSourceControlManager extends Command {
  constructor(protected sourceControlManager: SourceControlManager) {
    super("svn.getSourceControlManager");
  }

  public async execute() {
    return this.sourceControlManager;
  }
}
