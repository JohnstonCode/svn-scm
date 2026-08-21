import { commands, env, Uri, window } from "vscode";
import { SourceControlManager } from "../source_control_manager";
import { Command } from "./command";

export class CopyPermalink extends Command {
  constructor() {
    super("svn.copyPermalink");
  }

  public async execute(): Promise<void> {
    let fileUri: Uri | undefined = this.getUriFromActiveTab();

    if (!fileUri) {
      fileUri = window.activeTextEditor?.document.uri;
    }

    if (!fileUri) {
      window.showErrorMessage("No file is currently open");
      return;
    }
    if (fileUri.scheme !== "file") {
      window.showErrorMessage("File is not a local file");
      return;
    }

    const filePath = fileUri.fsPath;

    const sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    const repository = await sourceControlManager.getRepositoryFromUri(fileUri);
    if (!repository) {
      window.showErrorMessage("File is not in an SVN repository");
      return;
    }

    try {
      const info = await repository.getInfo(filePath);

      if (!info || !info.url || !info.commit || !info.commit.revision) {
        window.showErrorMessage(
          "Could not retrieve SVN information for this file"
        );
        return;
      }

      const revision = info.commit.revision;
      const permalink = `${info.url}?p=${revision}&r=${revision}`;

      const clipboard = (env as any).clipboard;
      if (clipboard === undefined) {
        window.showErrorMessage(
          "Clipboard is supported in VS Code 1.30 and newer"
        );
        return;
      }

      await clipboard.writeText(permalink);
      window.showInformationMessage(
        `Permalink copied to clipboard (revision ${revision})`
      );
    } catch (error) {
      window.showErrorMessage(`Failed to copy permalink: ${error}`);
    }
  }
}
