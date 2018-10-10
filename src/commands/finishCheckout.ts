import { Repository } from "../repository";
import { Command } from "./command";

export class FinishCheckout extends Command {
  constructor() {
    super("svn.finishCheckout", { repository: true });
  }

  public async execute(repository: Repository) {
    await repository.finishCheckout();
  }
}
