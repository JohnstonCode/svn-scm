import { Uri, window } from "vscode";
import { configuration } from "../helpers/configuration";
import { Repository } from "../repository";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class PromptRemove extends Command {
  constructor() {
    super("svn.promptRemove", { repository: true });
  }

  public async execute(repository: Repository, ...uris: Uri[]) {
    const files = uris.map(uri => uri.fsPath);
    const relativeList = files
      .map(file => repository.repository.removeAbsolutePath(file))
      .sort();
    const ignoreText = localize(
      "promptRemove.add_to_ignore",
      "Add to ignored list"
    );
    const yes = localize("promptRemove.yes", "Yes");
    const resp = await window.showInformationMessage(
      localize(
        "promptRemove.remove_from_svn",
        'The file(s) "{0}" are removed from disk.\nWould you like remove from SVN?'
      ),
      { modal: false },
      yes,
      ignoreText,
      localize("promptRemove.no", "No")
    );
    if (resp === yes) {
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
