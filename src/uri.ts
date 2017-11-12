import { Uri } from "vscode";

export function toSvnUri(uri: Uri, ref: string) {
  return uri.with({
    scheme: "svn",
    path: uri.path,
    query: JSON.stringify({
      path: uri.fsPath,
      ref
    })
  });
}
