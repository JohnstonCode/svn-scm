import { Range, window } from "vscode";
import { Command } from "./command";
import { LineChange } from "../common/types";

export class RevertSelectedRanges extends Command {
  constructor() {
    super("svn.revertSelectedRanges", { diff: true });
  }

  public async execute(changes: LineChange[]) {
    const textEditor = window.activeTextEditor;

    if (!textEditor) {
      return;
    }

    const modifiedDocument = textEditor.document;
    const selections = textEditor.selections;
    const selectedChanges = changes.filter(change => {
      const modifiedRange =
        change.modifiedEndLineNumber === 0
          ? new Range(
              modifiedDocument.lineAt(
                change.modifiedStartLineNumber - 1
              ).range.end,
              modifiedDocument.lineAt(
                change.modifiedStartLineNumber
              ).range.start
            )
          : new Range(
              modifiedDocument.lineAt(
                change.modifiedStartLineNumber - 1
              ).range.start,
              modifiedDocument.lineAt(
                change.modifiedEndLineNumber - 1
              ).range.end
            );

      return selections.every(
        selection => !selection.intersection(modifiedRange)
      );
    });

    if (selectedChanges.length === changes.length) {
      return;
    }

    await this._revertChanges(textEditor, selectedChanges);
  }
}
