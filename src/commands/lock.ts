import { Uri, window } from "vscode";
import { Command } from "./command";

export class Lock extends Command {
  constructor() {
    super("svn.lock");
  }

  public async execute(resourceUri?: Uri) {
    let uri: Uri | undefined = resourceUri;

    if (!uri) {
      uri = this.getUriFromActiveTab();
    }

    if (!uri) {
      uri = window.activeTextEditor?.document.uri;
    }

    if (!uri) {
      window.showErrorMessage("No file is currently open");
      return;
    }

    if (uri.scheme !== "file") {
      window.showErrorMessage("Can only lock files from the file system");
      return;
    }

    await this.runByRepository(uri, async (repository, resource) => {
      if (!repository) {
        return;
      }

      const path = resource.fsPath;

      try {
        await repository.lock([path]);
        window.showInformationMessage(`Successfully locked ${path}`);
      } catch (error) {
        console.log(error);
        window.showErrorMessage(`Unable to lock file: ${error}`);
      }
    });
  }
}
