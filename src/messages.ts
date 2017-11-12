import { window } from "vscode";

export function noChangesToCommit() {
  return window.showInformationMessage("There are no changes to commit.");
}

export function inputCommitMessage(message?: string) {
  return new Promise<string>((resolve, reject) => {
    if (message) {
      resolve(message);
      return;
    }

    window
      .showInputBox({
        value: "",
        placeHolder: "Commit message",
        prompt: "Please enter a commit message",
        ignoreFocusOut: true
      })
      .then(string => resolve(string));
  });
}

export function changesCommitted() {
  return window.showInformationMessage("Files Committed");
}
