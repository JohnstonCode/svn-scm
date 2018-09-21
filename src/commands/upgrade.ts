import { window } from "vscode";
import { configuration } from "../helpers/configuration";
import { Model } from "../model";
import { fixPathSeparator } from "../util";
import { Command } from "./command";

export class Upgrade extends Command {
  constructor(protected model: Model) {
    super("svn.upgrade", {}, model);
  }

  public async execute(folderPath: string) {
    if (!folderPath) {
      return;
    }

    if (configuration.get("ignoreWorkingCopyIsTooOld", false)) {
      return;
    }

    folderPath = fixPathSeparator(folderPath);

    const yes = "Yes";
    const no = "No";
    const neverShowAgain = "Don't Show Again";
    const choice = await window.showWarningMessage(
      "You want upgrade the working copy (svn upgrade)?",
      yes,
      no,
      neverShowAgain
    );

    if (choice === yes) {
      const upgraded = await this.model.upgradeWorkingCopy(folderPath);

      if (upgraded) {
        window.showInformationMessage(`Working copy "${folderPath}" upgraded`);
        this.model.tryOpenRepository(folderPath);
      } else {
        window.showErrorMessage(
          `Error on upgrading working copy "${folderPath}". See log for more detail`
        );
      }
    } else if (choice === neverShowAgain) {
      return configuration.update("ignoreWorkingCopyIsTooOld", true);
    }

    return;
  }
}
