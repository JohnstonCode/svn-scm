import { Repository } from "../repository";
import { Command } from "./command";

export class PatchAll extends Command {
  constructor() {
    super("svn.patchAll", { repository: true });
  }

  public async execute(repository: Repository) {
    const content = await repository.patch([]);
    await this.showDiffPath(repository, content);
  }
}
