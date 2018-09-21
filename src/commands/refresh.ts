import { Repository } from "../repository";
import { Command } from "./command";

export class Refresh extends Command {
  constructor() {
    super("svn.refresh", { repository: true });
  }

  public async execute(repository: Repository) {
    await repository.status();
  }
}
