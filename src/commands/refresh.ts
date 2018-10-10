import { Model } from "../model";
import { Repository } from "../repository";
import { Command } from "./command";

export class Refresh extends Command {
  constructor(protected model: Model) {
    super("svn.refresh", { repository: true }, model);
  }

  public async execute(repository: Repository) {
    await repository.status();
  }
}
