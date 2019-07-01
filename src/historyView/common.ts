import { createHash } from "crypto";
import * as path from "path";
import {
  commands,
  env,
  TextDocumentShowOptions,
  TreeItem,
  Uri,
  window
} from "vscode";
import { ISvnLogEntry, ISvnLogEntryPath } from "../common/types";
import { exists, lstat } from "../fs";
import { configuration } from "../helpers/configuration";
import { IRemoteRepository } from "../remoteRepository";
import { SvnRI } from "../svnRI";
import { dumpSvnFile } from "../tempFiles";

export enum LogTreeItemKind {
  Repo = 1,
  Commit,
  CommitDetail,
  TItem
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
  order: number;
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
  const clipboard = (env as any).clipboard;
  if (clipboard === undefined) {
    window.showErrorMessage("Clipboard is supported in VS Code 1.30 and newer");
    return;
  }
  if (item.kind === LogTreeItemKind.Commit) {
    const commit = item.data as ISvnLogEntry;
    switch (what) {
      case "msg":
      case "revision":
        await clipboard.writeText(commit[what]);
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
    titem.tooltip = "Log entries above do not exist in working copy";
    out.splice(i, 0, { kind: LogTreeItemKind.TItem, data: titem });
  }
  return undefined;
}

export async function checkIfFile(
  e: SvnRI,
  local: boolean
): Promise<boolean | undefined> {
  if (e.localFullPath === undefined) {
    if (local) {
      window.showErrorMessage("No working copy for this path");
    }
    return undefined;
  }
  let stat;
  try {
    stat = await lstat(e.localFullPath.fsPath);
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
  if (
    (!configuration.get("gravatars.enabled", true) as boolean) ||
    author === undefined
  ) {
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

async function downloadFile(
  repo: IRemoteRepository,
  arg: Uri,
  revision: string
): Promise<Uri> {
  if (revision === "BASE") {
    const nm = repo.getPathNormalizer();
    const ri = nm.parse(arg.toString(true));
    const localPath = ri.localFullPath;
    if (localPath === undefined || !(await exists(localPath.path))) {
      const errorMsg =
        "BASE revision doesn't exist for " +
        (localPath ? localPath.path : "remote path");
      window.showErrorMessage(errorMsg);
      throw new Error(errorMsg);
    }
    return localPath;
  }
  let out;
  try {
    out = await repo.show(arg, revision);
  } catch (e) {
    window.showErrorMessage("Failed to open path");
    throw e;
  }
  return dumpSvnFile(arg, revision, out);
}

export async function openDiff(
  repo: IRemoteRepository,
  arg: Uri,
  r1: string,
  r2: string
) {
  const uri1 = await downloadFile(repo, arg, r1);
  const uri2 = await downloadFile(repo, arg, r2);
  const opts: TextDocumentShowOptions = {
    preview: true
  };
  const title = `${path.basename(arg.path)} (${r1} : ${r2})`;
  return commands.executeCommand<void>("vscode.diff", uri1, uri2, title, opts);
}

export async function openFileRemote(
  repo: IRemoteRepository,
  arg: Uri,
  against: string
) {
  let out;
  try {
    out = await repo.show(arg, against);
  } catch {
    window.showErrorMessage("Failed to open path");
    return;
  }
  const localUri = await dumpSvnFile(arg, against, out);
  const opts: TextDocumentShowOptions = {
    preview: true
  };
  return commands.executeCommand<void>("vscode.open", localUri, opts);
}
