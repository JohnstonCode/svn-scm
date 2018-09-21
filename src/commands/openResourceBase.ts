import { Resource } from "../resource";
import { Command } from "./command";

export class OpenResourceBase extends Command {
  constructor() {
    super("svn.openResourceBase");
  }

  public async execute(resource: Resource) {
    await this._openResource(resource, "BASE", undefined, true, false);
  }
}
