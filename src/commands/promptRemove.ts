import { Uri, window } from "vscode";
import { configuration } from "../helpers/configuration";
import { Repository } from "../repository";
import { Command } from "./command";

export class PromptRemove extends Command {
  constructor() {
    super("svn.promptRemove", { repository: true });
  }

  public async execute(repository: Repository, ...uris: Uri[]) {
    const files = uris.map(uri => uri.fsPath);
    const relativeList = files
      .map(file => repository.repository.removeAbsolutePath(file))
      .sort();
    const ignoreText = "Add to ignored list";
    const resp = await window.showInformationMessage(
      `The file(s) "${relativeList.join(
        ", "
      )}" are removed from disk.\nWould you like remove from SVN?`,
      { modal: true },
      "Yes",
      ignoreText,
      "No"
    );
    if (resp === "Yes") {
      await repository.removeFiles(files, false);
    } else if (resp === ignoreText) {
      let ignoreList = configuration.get<string[]>(
        "delete.ignoredRulesForDeletedFiles",
        []
      );
      ignoreList.push(...relativeList);
      ignoreList = [...new Set(ignoreList)]; // Remove duplicates
      configuration.update("delete.ignoredRulesForDeletedFiles", ignoreList);
    }
  }
}
