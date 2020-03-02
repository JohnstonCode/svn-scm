import { Repository } from "../repository";
import { Command } from "./command";
import { window } from "vscode";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class RemoveUnversioned extends Command {
  constructor() {
    super("svn.removeUnversioned", { repository: true });
  }

  public async execute(repository: Repository) {
    const yes = localize("removeUnversioned.yes", "Yes");
    const answer = await window.showWarningMessage(
      localize(
        "removeUnversioned.remove_all",
        "Are you sure? This will remove all unversioned files except for ignored."
      ),
      { modal: true },
      yes,
      localize("removeUnversioned.no", "No")
    );
    if (answer !== yes) {
      return;
    }
    await repository.removeUnversioned();
  }
}
