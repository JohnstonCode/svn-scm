import * as path from "path";
import { commands, Uri, ViewColumn, WebviewPanel, window } from "vscode";
import { Model } from "./model";

export function noChangesToCommit() {
  return window.showInformationMessage("There are no changes to commit.");
}

let panel: WebviewPanel;

// for tests only
let callback: (message: string) => void;
commands.registerCommand("svn.forceCommitMessageTest", (message: string) => {
  if (callback) {
    return callback(message);
  }
});

export function dispose() {
  if (panel) {
    panel.dispose();
  }
}

async function showCommitInput(message?: string, filePaths?: string[]) {

  const promise = new Promise<string>(resolve => {

    // Close previous commit message input
    if (panel) {
      panel.dispose();
    }

    // for tests only
    callback = (m: string) => {
      resolve(m);
      panel.dispose();
    };

    panel = window.createWebviewPanel("svnCommitMessage", "Commit Message", {
      preserveFocus: false,
      viewColumn: ViewColumn.Active
    },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      });

    const styleUri = Uri.file(
      path.join(__dirname, "..", "css", "commit-message.css")
    ).with({ scheme: "vscode-resource" });

    let beforeForm = "";
    if (filePaths && filePaths.length) {
      const selectedFiles = filePaths.sort().map(f => `<li>${f}</li>`);

      if (selectedFiles.length) {
        beforeForm = `
<div class="file-list">
  <h3 class="title">Files to commit</h3>
  <ul>
    ${selectedFiles.join("\n")}
  </ul>
</div>`;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commit Message</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <section class="container">
    ${beforeForm}
    <form>
      <fieldset>
        <div class="float-right">
          <a href="#" id="pickCommitMessage">Pick a previous commit message</a>
        </div>
        <label for="message">Commit message</label>
        <textarea id="message" rows="3" placeholder="Message (press Ctrl+Enter to commit)"></textarea>
        <button id="commit" class="button-primary">Commit</button>
        <div class="float-right">
          <button id="cancel" class="button button-outline">Cancel</button>
        </div>
      </fieldset>
    </form>
  </section>
  <script>
    const vscode = acquireVsCodeApi();

    const txtMessage = document.getElementById("message");
    const btnCommit = document.getElementById("commit");
    const btnCancel = document.getElementById("cancel");
    const linkPickCommitMessage = document.getElementById("pickCommitMessage");

    // load current message
    txtMessage.value = ${JSON.stringify(message)};

    btnCommit.addEventListener("click", function() {
      vscode.postMessage({
        command: "commit",
        message: txtMessage.value
      });
    });

    btnCancel.addEventListener("click", function() {
      vscode.postMessage({
        command: "cancel"
      });
    });

    // Allow CTRL + Enter
    txtMessage.addEventListener("keydown", function(e) {
      if (event.ctrlKey && event.keyCode === 13) {
        btnCommit.click();
      }
    });

    // Auto resize the height of message
    txtMessage.addEventListener("input", function(e) {
      txtMessage.style.height = "auto";
      txtMessage.style.height = (txtMessage.scrollHeight) + "px";
    });

    window.addEventListener("load", function() {
      setTimeout(() => {
        txtMessage.focus();
      }, 1000);
    });

    linkPickCommitMessage.addEventListener("click", function() {
      vscode.postMessage({
        command: "pickCommitMessage"
      });
    });

    // Message from VSCode
    window.addEventListener("message", function(event) {
      const message = event.data;
      switch (message.command) {
        case "setMessage":
          txtMessage.value = message.message;
          txtMessage.dispatchEvent(new Event("input"));
          break;
      }
    });
  </script>
</body>
</html>`;

    panel.webview.html = html;

    // On close
    panel.onDidDispose(() => {
      resolve(undefined);
    });

    const pickCommitMessage = async () => {
      let repository;

      if (filePaths && filePaths[0]) {
        const model = (await commands.executeCommand("svn.getModel", "")) as Model;
        repository = await model.getRepositoryFromUri(Uri.file(filePaths[0]));
      }

      const message = await commands.executeCommand("svn.pickCommitMessage", repository);
      if (message !== undefined) {
        panel.webview.postMessage({
          command: "setMessage",
          message
        });
      }
    };

    // On button click
    panel.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case "commit":
          resolve(message.message);
          panel.dispose();
          break;
        case "pickCommitMessage":
          pickCommitMessage();
          break;
        default:
          resolve(undefined);
          panel.dispose();
      }
    });

    // Force show and activate
    panel.reveal(ViewColumn.Active, false);
  });

  return await promise;
}

export async function inputCommitMessage(
  message?: string,
  promptNew: boolean = true,
  filePaths?: string[]
): Promise<string | undefined> {
  if (promptNew) {
    message = await showCommitInput(message, filePaths);
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
