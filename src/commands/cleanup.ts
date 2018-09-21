import { Model } from "../model";
import { Repository } from "../repository";
import { Command } from "./command";

export class Cleanup extends Command {
  constructor(protected model: Model) {
    super("svn.cleanup", { repository: true }, model);
  }

  public async execute(repository: Repository) {
    await repository.cleanup();
  }
}
