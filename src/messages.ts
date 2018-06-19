import { window } from "vscode";

export function noChangesToCommit() {
  return window.showInformationMessage("There are no changes to commit.");
}

export async function inputCommitMessage(
  message?: string,
  promptNew: boolean = true
): Promise<string | undefined> {
  if (promptNew) {
    message = await window.showInputBox({
      value: message,
      placeHolder: "Commit message",
      prompt: "Please enter a commit message",
      ignoreFocusOut: true
    });
  }

  if (message === "") {
    const allowEmpty = await window.showWarningMessage(
      "Do you really want to commit an empty message?",
      { modal: true },
      "Yes"
    );

    if (allowEmpty === "Yes") {
      return "";
    } else {
      return undefined;
    }
  }
  return message;
}
