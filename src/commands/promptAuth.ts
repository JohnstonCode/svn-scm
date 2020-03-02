import { window } from "vscode";
import { IAuth } from "../common/types";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class PromptAuth extends Command {
  constructor() {
    super("svn.promptAuth");
  }

  public async execute(prevUsername?: string, prevPassword?: string) {
    const username = await window.showInputBox({
      placeHolder: localize(
        "promptAuth.username_placeholder",
        "Svn repository username"
      ),
      prompt: localize(
        "promptAuth.username_prompt",
        "Please enter your username"
      ),
      value: prevUsername
    });

    if (username === undefined) {
      return;
    }

    const password = await window.showInputBox({
      placeHolder: localize(
        "promptAuth.password_placeholder",
        "Svn repository password"
      ),
      prompt: localize(
        "promptAuth.password_prompt",
        "Please enter your password"
      ),
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
