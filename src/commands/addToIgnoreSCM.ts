import { SourceControlResourceState } from "vscode";
import { Model } from "../model";
import { Command } from "./command";

export class AddToIgnoreSCM extends Command {
  constructor(protected model: Model) {
    super("svn.addToIgnoreSCM", { repository: true }, model);
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    return this.addToIgnore(uris);
  }
}
