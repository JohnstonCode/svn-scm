import { SourceControlResourceState, Uri } from "vscode";
import { Resource } from "../resource";
import { Command } from "./command";

export class OpenChangeHead extends Command {
  constructor() {
    super("svn.openChangeHead", {});
  }

  public async execute(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ) {
    return this.openChange(arg, "HEAD", resourceStates);
  }
}
