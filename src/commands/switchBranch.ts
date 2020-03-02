import { window } from "vscode";
import { selectBranch } from "../helpers/branch";
import { Repository } from "../repository";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class SwitchBranch extends Command {
  constructor() {
    super("svn.switchBranch", { repository: true });
  }

  public async execute(repository: Repository) {
    const branch = await selectBranch(repository, true);

    if (!branch) {
      return;
    }

    try {
      if (branch.isNew) {
        const commitMessage = await window.showInputBox({
          value: localize(
            "switchBranch.create_new",
            "Created new branch {0}",
            branch.name
          ),
          prompt: localize(
            "switchBranch.commit_message",
            "Commit message for create branch {0}",
            branch.name
          )
        });

        // If press ESC on commit message
        if (commitMessage === undefined) {
          return;
        }

        await repository.newBranch(branch.path, commitMessage);
      } else {
        try {
          await repository.switchBranch(branch.path);
        } catch (error) {
          if (
            typeof error === "object" &&
            error.hasOwnProperty("stderrFormated") &&
            error.stderrFormated.includes("ignore-ancestry")
          ) {
            const yes = localize("switchBranch.yes", "Yes");
            const answer = await window.showErrorMessage(
              localize(
                "switchBranch.ancestor_error",
                "Seems like these branches don't have a common ancestor. Do you want to retry with '--ignore-ancestry' option?"
              ),
              yes,
              localize("switchBranch", "No")
            );
            if (answer === yes) {
              await repository.switchBranch(branch.path, true);
            }
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.log(error);
      if (branch.isNew) {
        window.showErrorMessage(
          localize(
            "switchBranch.unable_to_create",
            "Unable to create new branch"
          )
        );
      } else {
        window.showErrorMessage(
          localize("switchBranch.unable_to_switch", "Unable to switch branch")
        );
      }
    }
  }
}
