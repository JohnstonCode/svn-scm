import { SourceControlResourceState, Uri } from "vscode";
import { Resource } from "../resource";
import { Command } from "./command";

export class OpenChangeBase extends Command {
  constructor() {
    super("svn.openChangeBase");
  }

  public async execute(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ) {
    return this.openChange(arg, "BASE", resourceStates);
  }
}
