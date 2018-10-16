import { configuration } from "../helpers/configuration";
import { Repository } from "../repository";
import { Command } from "./command";

export class Refresh extends Command {
  constructor() {
    super("svn.refresh", { repository: true });
  }

  public async execute(repository: Repository) {
    const refreshRemoteChanges = configuration.get<boolean>(
      "refresh.remoteChanges",
      false
    );

    await repository.status();

    if (refreshRemoteChanges) {
      await repository.updateRemoteChangedFiles();
    }
  }
}
