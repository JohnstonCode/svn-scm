import { Uri } from "vscode";

export enum SvnUriAction {
  LOG = "LOG",
  PATCH = "PATCH",
  SHOW = "SHOW"
}

export interface SvnUriExtraParams {
  ref?: string;
  limit?: string;
  [key: string]: any;
}

export interface SvnUriParams {
  action: SvnUriAction;
  fsPath: string;
  extra: SvnUriExtraParams;
}

export function fromSvnUri(uri: Uri): SvnUriParams {
  return JSON.parse(uri.query);
}

export function toSvnUri(uri: Uri, action: SvnUriAction, extra: SvnUriExtraParams = {}): Uri {
  const params: SvnUriParams = {
    action: action,
    fsPath: uri.fsPath,
    extra: extra
  };

  return uri.with({
    scheme: "svn",
    path: uri.path,
    query: JSON.stringify(params)
  });
}
