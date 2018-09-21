import { Model } from "../model";
import { Repository } from "../repository";
import { Command } from "./command";

export class PatchAll extends Command {
  constructor(protected model: Model) {
    super("svn.patchAll", { repository: true }, model);
  }

  public async execute(repository: Repository) {
    const content = await repository.patch([]);
    await this.showDiffPath(repository, content);
  }
}
