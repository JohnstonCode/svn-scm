import * as os from "os";
import * as path from "path";
import { Uri } from "vscode";
import { writeFile } from "./fs/write_file";
import { exists } from "./fs/exists";
import { mkdir } from "./fs/mkdir";

export const tempdir = path.join(os.tmpdir(), "vscode-svn");

export async function dumpSvnFile(
  snvUri: Uri,
  revision: string,
  payload: string
): Promise<Uri> {
  if (!await exists(tempdir)) {
    await mkdir(tempdir);
  }
  const fname = `r${revision}_${path.basename(snvUri.fsPath)}`;
  const fpath = path.join(tempdir, fname);
  await writeFile(fpath, payload);
  return Uri.file(fpath);
}
