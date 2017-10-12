const { window } = require("vscode");

function noChangesToCommit() {
  return window.showInformationMessage("There are no changes to commit.");
}

function inputCommitMessage(message) {
  return new Promise((resolve, reject) => {
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

exports.noChangesToCommit = noChangesToCommit;
exports.inputCommitMessage = inputCommitMessage;
