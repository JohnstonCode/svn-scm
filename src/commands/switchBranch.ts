import { window } from "vscode";
import { selectBranch } from "../helpers/branch";
import { Repository } from "../repository";
import { Command } from "./command";

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
          value: `Created new branch ${branch.name}`,
          prompt: `Commit message for create branch ${branch.name}`
        });

        // If press ESC on commit message
        if (commitMessage === undefined) {
          return;
        }

        await repository.newBranch(branch.path, commitMessage);
      } else {
        await repository.switchBranch(branch.path);
      }
    } catch (error) {
      console.log(error);
      if (branch.isNew) {
        window.showErrorMessage("Unable to create new branch");
      } else {
        window.showErrorMessage("Unable to switch branch");
      }
    }
  }
}
