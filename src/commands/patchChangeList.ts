import { getPatchChangelist } from "../changelistItems";
import { Repository } from "../repository";
import { Command } from "./command";

export class PatchChangeList extends Command {
  constructor() {
    super("svn.patchChangeList", { repository: true });
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
