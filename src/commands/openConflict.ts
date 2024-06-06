import { SourceControlResourceState, Uri, commands } from "vscode";
import { Command } from "./command";

export class OpenConflict extends Command {
  constructor() {
    super("svn.openConflict");
  }

  public async execute(...resourceStates: SourceControlResourceState[]) {
    const selection = await this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    this.runByRepository(selection[0].resourceUri, async (repo, result) => {
      const info = await repo.repository.getInfo(result.fsPath);

      if (
        !info.conflict ||
        !info.conflict.curBaseFile ||
        !info.conflict.prevWcFile ||
        !info.conflict.prevBaseFile
      ) {
        return;
      }

      const input1 = Uri.file(info.conflict.curBaseFile);
      const input2 = Uri.file(info.conflict.prevWcFile);
      const base = Uri.file(info.conflict.prevBaseFile);

      // TODO: _open.mergeEditor is not currently exposed to non-builtin VSCode extensions.
      // Update the command when there is an externally facing API.
      // See https://github.com/microsoft/vscode/tree/15bdea120dc16143a6ec01ad5f12bc273632a483/extensions/git/src/commands.ts#L748 for example usage.
      await commands.executeCommand("_open.mergeEditor", {
        base,
        input1,
        input2,
        output: result
      });
    });
  }
}
