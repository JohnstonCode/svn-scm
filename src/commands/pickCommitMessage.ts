import { QuickPickItem, window } from "vscode";
import { Repository } from "../repository";
import { Command } from "./command";

export class PickCommitMessage extends Command {
  constructor() {
    super("svn.pickCommitMessage", { repository: true });
  }

  public async execute(repository: Repository) {
    const logs = await repository.log("HEAD", "0", 20);

    if (!logs.length) {
      return;
    }

    const picks: QuickPickItem[] = logs.map(l => {
      return {
        label: l.msg,
        description: `r${l.revision} | ${l.author} | ${new Date(
          l.date
        ).toLocaleString()}`
      };
    });

    const selected = await window.showQuickPick(picks);

    if (selected === undefined) {
      return;
    }

    const msg = selected.label;

    repository.inputBox.value = msg;

    return msg;
  }
}
