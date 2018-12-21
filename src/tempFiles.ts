// use import { promises as fs } from "fs"; when nodejs will be updated
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as util from "util";
import { Uri } from "vscode";

const writeFile = util.promisify(fs.writeFile);

export const tempdir = path.join(os.tmpdir(), "vscode-svn");

export async function dumpSvnFile(
  snvUri: Uri,
  revision: string,
  payload: string
): Promise<Uri> {
  if (!fs.existsSync(tempdir)) {
    await fs.mkdirSync(tempdir);
  }
  const fname = `r${revision}_${path.basename(snvUri.fsPath)}`;
  const fpath = path.join(tempdir, fname);
  await writeFile(fpath, payload);
  return Uri.file(fpath);
}
