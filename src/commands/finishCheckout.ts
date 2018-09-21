import { Model } from "../model";
import { Repository } from "../repository";
import { Command } from "./command";

export class FinishCheckout extends Command {
  constructor(protected model: Model) {
    super("svn.finishCheckout", { repository: true }, model);
  }

  public async execute(repository: Repository) {
    await repository.finishCheckout();
  }
}
