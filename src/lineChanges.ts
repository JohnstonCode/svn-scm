import { LineChange, Range, TextDocument } from "vscode";

export function applyLineChanges(
  original: TextDocument,
  modified: TextDocument,
  diffs: LineChange[]
): string {
  const result: string[] = [];
  let currentLine = 0;

  for (const diff of diffs) {
    const isInsertion = diff.originalEndLineNumber === 0;
    const isDeletion = diff.modifiedEndLineNumber === 0;

    result.push(
      original.getText(
        new Range(
          currentLine,
          0,
          isInsertion
            ? diff.originalStartLineNumber
            : diff.originalStartLineNumber - 1,
          0
        )
      )
    );

    if (!isDeletion) {
      let fromLine = diff.modifiedStartLineNumber - 1;
      let fromCharacter = 0;

      if (isInsertion && diff.originalStartLineNumber === original.lineCount) {
        fromLine = original.lineCount - 1;
        fromCharacter = original.lineAt(fromLine).range.end.character;
      }

      result.push(
        modified.getText(
          new Range(fromLine, fromCharacter, diff.modifiedEndLineNumber, 0)
        )
      );
    }

    currentLine = isInsertion
      ? diff.originalStartLineNumber
      : diff.originalEndLineNumber;
  }

  result.push(
    original.getText(new Range(currentLine, 0, original.lineCount, 0))
  );

  return result.join("");
}
