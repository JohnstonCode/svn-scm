import { getPatchChangelist } from "../changelistItems";
import { Model } from "../model";
import { Repository } from "../repository";
import { Command } from "./command";

export class PatchChangeList extends Command {
  constructor(protected model: Model) {
    super("svn.patchChangeList", { repository: true }, model);
  }

  public async execute(repository: Repository) {
    const changelistName = await getPatchChangelist(repository);

    if (!changelistName) {
      return;
    }

    const content = await repository.patchChangelist(changelistName);
    await this.showDiffPath(repository, content);
  }
}
