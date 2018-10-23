import { Resource } from "../resource";
import { Command } from "./command";

export class OpenResourceHead extends Command {
  constructor() {
    super("svn.openResourceHead");
  }

  public async execute(resource: Resource) {
    await this._openResource(resource, "HEAD", undefined, true, false);
  }
}
