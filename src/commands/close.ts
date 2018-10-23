import { commands } from "vscode";
import { Model } from "../model";
import { Repository } from "../repository";
import { Command } from "./command";

export class Close extends Command {
  constructor() {
    super("svn.close", { repository: true });
  }

  public async execute(repository: Repository) {
    const model = (await commands.executeCommand("svn.getModel", "")) as Model;

    model.close(repository);
  }
}
