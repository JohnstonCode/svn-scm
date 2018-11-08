import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import * as tmp from "tmp";
import { Uri } from "vscode";

export async function dumpSvnFile(
  snvUri: Uri,
  revision: string,
  payload: string
): Promise<Uri> {
  const tempdir = path.join(os.tmpdir(), "vscode-svm");
  try {
    await fs.access(tempdir);
  } catch {
    await fs.mkdir(tempdir);
  }
  const fname = `${path.basename(snvUri.fsPath)}_${revision}`;
  await fs.writeFile(fname, payload);
  return Uri.parse(`file://${fname}`);
}
