import { Uri } from "vscode";

export interface SvnUriParams {
  path: string;
  ref: string;
}

export function fromSvnUri(uri: Uri): SvnUriParams {
  return JSON.parse(uri.query);
}

export function toSvnUri(uri: Uri, ref: string): Uri {
  return uri.with({
    scheme: "svn",
    path: uri.path,
    query: JSON.stringify({
      path: uri.fsPath,
      ref
    })
  });
}
