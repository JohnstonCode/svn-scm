import { Model } from "../model";
import { Command } from "./command";

export class GetModel extends Command {
  constructor(protected model: Model) {
    super("svn.getModel");
  }

  public async execute() {
    return this.model;
  }
}
