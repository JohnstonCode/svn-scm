import { Uri } from "vscode";
import {
  ISvnUriExtraParams,
  ISvnUriParams,
  SvnUriAction
} from "./common/types";

export function fromSvnUri(uri: Uri): ISvnUriParams {
  return JSON.parse(uri.query);
}

export function toSvnUri(
  uri: Uri,
  action: SvnUriAction,
  extra: ISvnUriExtraParams = {},
  replaceFileExtension = false
): Uri {
  const params: ISvnUriParams = {
    action,
    fsPath: uri.fsPath,
    extra
  };

  return uri.with({
    scheme: "svn",
    path: replaceFileExtension ? uri.path + ".svn" : uri.path,
    query: JSON.stringify(params)
  });
}
