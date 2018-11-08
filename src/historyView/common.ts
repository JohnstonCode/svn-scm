import { createHash } from "crypto";
import * as path from "path";
import { TreeItem, Uri } from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { configuration } from "../helpers/configuration";
import { Repository } from "../repository";

export enum LogTreeItemKind {
  Repo = 1,
  Commit,
  CommitDetail,
  Action
}

// svn:// or ^/ or WC-path
export type SvnPath = string;

export interface ILogTreeItem {
  readonly kind: LogTreeItemKind;
  data: ISvnLogEntry | ISvnLogEntryPath | SvnPath | TreeItem;
}

export interface ICachedLog {
  entries: ISvnLogEntry[];
  // svn-like path
  readonly svnTarget: string;
  isComplete: boolean;
  readonly repo: Repository;
  readonly persisted: {
    readonly commitFrom: string;
    readonly userAdded?: boolean;
  };
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

export function svnFullPathToUri(
  path: ISvnLogEntryPath,
  repo: Repository
): Uri {
  return Uri.parse(`svn://${repo.root}${path._}`); // FIXME root -> svnRoot
}

function needFetch(
  cached: ISvnLogEntry[],
  fetched: ISvnLogEntry[],
  limit: number
): boolean {
  if (cached.length && cached[cached.length - 1].revision === "1") {
    return false;
  }
  if (fetched.length === 0 || fetched[fetched.length - 1].revision === "1") {
    return false;
  }
  if (fetched.length < limit) {
    return false;
  }
  return true;
}

/// @note: cached.svnTarget should be valid
export async function fetchMore(cached: ICachedLog) {
  let rfrom = cached.persisted.commitFrom;
  const entries = cached.entries;
  if (entries.length) {
    rfrom = entries[entries.length - 1].revision;
    rfrom = (Number.parseInt(rfrom, 10) - 1).toString();
  }
  let moreCommits: ISvnLogEntry[] = [];
  const limit = getLimit();
  try {
    moreCommits = await cached.repo.log2(rfrom, "1", limit, cached.svnTarget);
  } catch {
    // Item didn't exist
  }
  if (!needFetch(entries, moreCommits, limit)) {
    cached.isComplete = true;
  }
  entries.push(...moreCommits);
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
