import { window } from "vscode";
import { IAuth } from "../common/types";
import { Command } from "./command";

export class PromptAuth extends Command {
  constructor() {
    super("svn.promptAuth");
  }

  public async execute(prevUsername?: string, prevPassword?: string) {
    const username = await window.showInputBox({
      placeHolder: "Svn repository username",
      prompt: "Please enter your username",
      value: prevUsername
    });

    if (username === undefined) {
      return;
    }

    const password = await window.showInputBox({
      placeHolder: "Svn repository password",
      prompt: "Please enter your password",
      value: prevPassword,
      password: true
    });

    if (password === undefined) {
      return;
    }

    const auth: IAuth = {
      username,
      password
    };

    return auth;
  }
}
