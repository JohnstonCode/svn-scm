import { Uri } from "vscode";
import { Model } from "../model";
import { Command } from "./command";

export class AddToIgnoreExplorer extends Command {
  constructor(protected model: Model) {
    super("svn.addToIgnoreExplorer", { repository: true }, model);
  }

  public async execute(mainUri?: Uri, allUris?: Uri[]) {
    if (!allUris || allUris.length === 0) {
      return;
    }

    return this.addToIgnore(allUris);
  }
}
