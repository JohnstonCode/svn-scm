import { commands, window } from "vscode";
import { configuration } from "../helpers/configuration";
import { SourceControlManager } from "../source_control_manager";
import { fixPathSeparator } from "../util";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class Upgrade extends Command {
  constructor() {
    super("svn.upgrade");
  }

  public async execute(folderPath: string) {
    if (!folderPath) {
      return;
    }

    if (configuration.get("ignoreWorkingCopyIsTooOld", false)) {
      return;
    }

    folderPath = fixPathSeparator(folderPath);

    const yes = localize("upgrade.yes", "Yes");
    const no = localize("upgrade.no", "No");
    const neverShowAgain = localize(
      "upgrade.dont_show_again",
      "Don't Show Again"
    );
    const choice = await window.showWarningMessage(
      localize(
        "upgrade.upgrade_working_copy",
        "You want upgrade the working copy (svn upgrade)?"
      ),
      yes,
      no,
      neverShowAgain
    );
    const sourceControlManager = (await commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    )) as SourceControlManager;

    if (choice === yes) {
      const upgraded = await sourceControlManager.upgradeWorkingCopy(
        folderPath
      );

      if (upgraded) {
        window.showInformationMessage(
          localize(
            "upgrade.working_copy_upgraded",
            "Working copy '{0}' upgraded",
            folderPath
          )
        );
        sourceControlManager.tryOpenRepository(folderPath);
      } else {
        window.showErrorMessage(
          localize(
            "upgrade.upgrade_error",
            "Error on upgrading working copy '{0}'. See log for more detail",
            folderPath
          )
        );
      }
    } else if (choice === neverShowAgain) {
      return configuration.update("ignoreWorkingCopyIsTooOld", true);
    }

    return;
  }
}
