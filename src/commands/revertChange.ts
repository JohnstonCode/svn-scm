import { Uri, window } from "vscode";
import { Command } from "./command";
import { LineChange } from "../common/types";

export class RevertChange extends Command {
  constructor() {
    super("svn.revertChange");
  }

  public async execute(uri: Uri, changes: LineChange[], index: number) {
    const textEditor = window.visibleTextEditors.filter(
      e => e.document.uri.toString() === uri.toString()
    )[0];

    if (!textEditor) {
      return;
    }

    await this._revertChanges(textEditor, [
      ...changes.slice(0, index),
      ...changes.slice(index + 1)
    ]);
  }
}
