import { Repository } from "../repository";
import { Command } from "./command";

export class RefreshRemoteChanges extends Command {
  constructor() {
    super("svn.refreshRemoteChanges", { repository: true });
  }

  public async execute(repository: Repository) {
    await repository.updateRemoteChangedFiles();
  }
}
