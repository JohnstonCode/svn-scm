import { SourceControlResourceState, Uri } from "vscode";
import { Resource } from "../resource";
import IncomingChangeNode from "../treeView/nodes/incomingChangeNode";
import { Command } from "./command";

export class OpenChangePrev extends Command {
  constructor() {
    super("svn.openChangePrev", {});
  }

  public async execute(
    arg?: Resource | Uri | IncomingChangeNode,
    ...resourceStates: SourceControlResourceState[]
  ) {
    return this.openChange(arg, "PREV", resourceStates);
  }
}
