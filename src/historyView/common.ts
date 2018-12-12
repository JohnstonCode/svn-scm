import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { env, TreeItem, Uri, window } from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { configuration } from "../helpers/configuration";
import { IRemoteRepository } from "../remoteRepository";
import { SvnRI } from "../svnRI";

export enum LogTreeItemKind {
  Repo = 1,
  Commit,
  CommitDetail,
  Action
}

// svn:// or ^/ or WC-path
export class SvnPath {
  constructor(private path: string) {}
  public toString(): string {
    return this.path;
  }
}

export interface ICachedLog {
  entries: ISvnLogEntry[];
  // Uri of svn repository
  svnTarget: Uri;
  isComplete: boolean;
  repo: IRemoteRepository;
  persisted: {
    readonly commitFrom: string;
    baseRevision?: number;
    readonly userAdded?: boolean;
  };
}

type TreeItemData = ISvnLogEntry | ISvnLogEntryPath | SvnPath | TreeItem;

export interface ILogTreeItem {
  readonly kind: LogTreeItemKind;
  data: TreeItemData;
  readonly parent?: ILogTreeItem;
}

export function transform(
  array: TreeItemData[],
  kind: LogTreeItemKind,
  parent?: ILogTreeItem
): ILogTreeItem[] {
  return array.map(data => {
    return { kind, data, parent };
  });
}

export function getIconObject(iconName: string): { light: Uri; dark: Uri } {
  // XXX Maybe use full path to extension?
  const iconsRootPath = path.join(__dirname, "..", "..", "icons");
  const toUri = (theme: string) =>
    Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
  return {
    light: toUri("light"),
    dark: toUri("dark")
  };
}

export async function copyCommitToClipboard(what: string, item: ILogTreeItem) {
  if (item.kind === LogTreeItemKind.Commit) {
    const commit = item.data as ISvnLogEntry;
    switch (what) {
      case "msg":
      case "revision":
        await env.clipboard.writeText(commit[what]);
    }
  }
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

export function insertBaseMarker(
  item: ICachedLog,
  entries: ISvnLogEntry[],
  out: ILogTreeItem[]
): TreeItem | undefined {
  const baseRev = item.persisted.baseRevision;
  if (
    entries.length &&
    baseRev &&
    parseInt(entries[0].revision, 10) > baseRev
  ) {
    let i = 1;
    while (entries.length > i && parseInt(entries[i].revision, 10) > baseRev) {
      i++;
    }
    const titem = new TreeItem("BASE");
    out.splice(i, 0, { kind: LogTreeItemKind.Action, data: titem });
  }
  return undefined;
}

export function checkIfFile(e: SvnRI, local: boolean): boolean | undefined {
  if (e.localFullPath === undefined) {
    if (local) {
      window.showErrorMessage("No working copy for this path");
    }
    return undefined;
  }
  let stat;
  try {
    stat = fs.lstatSync(e.localFullPath.fsPath);
  } catch {
    window.showWarningMessage(
      "Not available from this working copy: " + e.localFullPath
    );
    return false;
  }
  if (!stat.isFile()) {
    window.showErrorMessage("This target is not a file");
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
    moreCommits = await cached.repo.log(rfrom, "1", limit, cached.svnTarget);
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

export function getCommitIcon(
  author: string,
  size: number = 16
): Uri | { light: Uri; dark: Uri } {
  if (!configuration.get("gravatars.enabled", true) as boolean) {
    return getIconObject("icon-commit");
  }

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
  const fstLine = commit.msg.split(/\r?\n/, 1)[0];
  return `${fstLine} • r${commit.revision}`;
}

export function getCommitToolTip(commit: ISvnLogEntry): string {
  let date = commit.date;
  if (!isNaN(Date.parse(date))) {
    date = new Date(date).toString();
  }
  return `Author: ${commit.author}
${date}
Revision: ${commit.revision}
Message: ${commit.msg}`;
}
