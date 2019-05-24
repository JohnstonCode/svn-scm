import { Uri } from "vscode";
import { Command } from "./command";

export class AddToIgnoreExplorer extends Command {
  constructor() {
    super("svn.addToIgnoreExplorer");
  }

  public async execute(_mainUri?: Uri, allUris?: Uri[]) {
    if (!allUris || allUris.length === 0) {
      return;
    }

    return this.addToIgnore(allUris);
  }
}
