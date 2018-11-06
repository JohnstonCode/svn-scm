import { createHash } from "crypto";
import * as path from "path";
import { TreeItem, Uri } from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { configuration } from "../helpers/configuration";

export enum LogTreeItemKind {
  Repo,
  Commit,
  CommitDetail,
  Action
}

export type RepoRoot = string;

export interface ILogTreeItem {
  kind: LogTreeItemKind;
  data: ISvnLogEntry | ISvnLogEntryPath | RepoRoot | TreeItem;
}

export function transform(array: any[], kind: LogTreeItemKind): ILogTreeItem[] {
  return array.map(data => {
    return { kind, data };
  });
}

// XXX code duplication with uri.ts. Maybe use full path?
export function getIconObject(iconName: string) {
  const iconsRootPath = path.join(__dirname, "..", "..", "icons");
  const toUri = (theme: string) =>
    Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
  return {
    light: toUri("light"),
    dark: toUri("dark")
  };
}
export function getLimit(): number {
  const limit = Number.parseInt(
    configuration.get<string>("log.length") || "50",
    10
  );
  if (isNaN(limit) || limit <= 0) {
    throw new Error("Invalid log.length setting value");
  }
  return limit;
}

const gravatarCache: Map<string, Uri> = new Map();

function md5(s: string): string {
  const data = createHash("md5");
  data.write(s);
  return data.digest().toString("hex");
}

export function getGravatarUri(author: string, size: number = 16): Uri {
  let gravatar = gravatarCache.get(author);
  if (gravatar !== undefined) {
    return gravatar;
  }

  gravatar = Uri.parse(
    `https://www.gravatar.com/avatar/${md5(author)}.jpg?s=${size}&d=robohash`
  );

  gravatarCache.set(author, gravatar);

  return gravatar;
}

export function getCommitLabel(commit: ISvnLogEntry): string {
  return `${commit.msg} • r${commit.revision}`;
}
