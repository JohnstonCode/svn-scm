import { window } from "vscode";
import { Model } from "../model";
import { Repository } from "../repository";
import { Command } from "./command";

export class PromptAuth extends Command {
  constructor(protected model: Model) {
    super("svn.promptAuth", { repository: true });
  }

  public async execute(repository: Repository) {
    const username = await window.showInputBox({
      placeHolder: "Svn repository username",
      prompt: "Please enter your username",
      value: repository.username
    });

    if (username === undefined) {
      return false;
    }

    const password = await window.showInputBox({
      placeHolder: "Svn repository password",
      prompt: "Please enter your password",
      password: true
    });

    if (username === undefined) {
      return false;
    }

    repository.username = username;
    repository.password = password;

    return true;
  }
}
