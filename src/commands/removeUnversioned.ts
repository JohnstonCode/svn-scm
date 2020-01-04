import { Repository } from "../repository";
import { Command } from "./command";
import { window } from "vscode";
import { VersionError } from "../svn";

export class RemoveUnversioned extends Command {
  constructor() {
    super("svn.removeUnversioned", { repository: true });
  }

  public async execute(repository: Repository) {
    const answer = await window.showWarningMessage(
      "Are you sure? This will remove all unversioned files except for ignored.",
      { modal: true },
      "Yes",
      "No"
    );
    if (answer !== "Yes") {
      return;
    }
    try {
      await repository.removeUnversioned();
    } catch (e) {
      if (e instanceof VersionError) {
        window.showErrorMessage(
          "Your svn is too old and does not support this feature"
        );
      } else {
        throw e;
      }
    }
  }
}
