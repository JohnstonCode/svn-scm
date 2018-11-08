import * as fs from "fs";
import * as tmp from "tmp";
import { Uri } from "vscode";
import { Command } from "./command";

export class OpenDiff extends Command {
  constructor() {
    super("svn.openDiff");
  }

  public async execute(arg?: Uri, against?: string) {
    // return this.openChange(arg, against, []);
    // TODO
  }
}
