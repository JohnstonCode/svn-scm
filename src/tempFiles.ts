import * as os from "os";
import * as path from "path";
import { Uri } from "vscode";
import { exists, mkdir, writeFile } from "./fs";
import * as crypto from "crypto";
import { iconv } from "./vscodeModules";
import { configuration } from "./helpers/configuration";

export const tempdir = path.join(os.tmpdir(), "vscode-svn", os.userInfo().uid.toString());

export async function createTempSvnRevisionFile(
  svnUri: Uri,
  revision: string,
  payload: string
): Promise<Uri> {
  if (!(await exists(tempdir))) {
    await mkdir(tempdir);
  }

  const fname = `r${revision}_${path.basename(svnUri.fsPath)}`;
  const hash = crypto.createHash("md5");
  const data = hash.update(svnUri.path);
  const filePathHash = data.digest("hex");
  const encoding = configuration.get<string>("default.encoding");

  if (!(await exists(path.join(tempdir, filePathHash)))) {
    await mkdir(path.join(tempdir, filePathHash));
  }

  const fpath = path.join(tempdir, filePathHash, fname);
  if (encoding) {
    const encodedPayload = iconv.encode(payload, encoding);
    await writeFile(fpath, encodedPayload);
  } else {
    await writeFile(fpath, payload);
  }
  return Uri.file(fpath);
}
