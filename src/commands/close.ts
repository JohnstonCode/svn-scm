import { Model } from "../model";
import { Repository } from "../repository";
import { Command } from "./command";

export class Close extends Command {
  constructor(protected model: Model) {
    super("svn.close", { repository: true }, model);
  }

  public async execute(repository: Repository) {
    this.model.close(repository);
  }
}
