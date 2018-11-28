import { SourceControlResourceState } from "vscode";
import { Command } from "./command";

export class AddToIgnoreSCM extends Command {
  constructor() {
    super("svn.addToIgnoreSCM");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    return this.addToIgnore(uris);
  }
}
