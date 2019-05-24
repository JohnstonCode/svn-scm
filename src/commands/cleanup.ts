import { Repository } from "../repository";
import { Command } from "./command";

export class Cleanup extends Command {
  constructor() {
    super("svn.cleanup", { repository: true });
  }

  public async execute(repository: Repository) {
    await repository.cleanup();
  }
}
