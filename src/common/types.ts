import { SpawnOptions } from "child_process";
import { Disposable, SourceControlResourceGroup, Uri } from "vscode";
import { Repository } from "../repository";
import { Resource } from "../resource";

/** Marker for constructors returning Promise<this> */
export enum ConstructorPolicy {
  Async,
  LateInit
}

export interface IBranchItem {
  name: string;
  path: string;
  isNew?: boolean;
}

export interface ICommandOptions {
  repository?: boolean;
  diff?: boolean;
}

export interface ICommand {
  commandId: string;
  key: string;
  method: Function;
  options: ICommandOptions;
}

export interface IConflictOption {
  label: string;
  description: string;
}

export interface ISvnInfo {
  kind: string;
  path: string;
  revision: string;
  url: string;
  relativeUrl: string;
  repository: {
    root: string;
    uuid: string;
  };
  wcInfo?: {
    wcrootAbspath: string;
    uuid: string;
  };
  commit: {
    revision: string;
    author: string;
    date: string;
  };
}

export interface ISvnListItem {
  kind: SvnKindType;
  name: string;
  size: string;
  commit: {
    revision: string;
    author: string;
    date: string;
  };
}

export enum SvnKindType {
  FILE = "file",
  DIR = "dir"
}

export interface IModelChangeEvent {
  repository: Repository;
  uri: Uri;
}

export interface IOriginalResourceChangeEvent {
  repository: Repository;
  uri: Uri;
}

export interface IOpenRepository extends Disposable {
  repository: Repository;
}

export enum RepositoryState {
  Idle,
  Disposed
}

export enum Operation {
  Add = "Add",
  AddChangelist = "AddChangelist",
  CleanUp = "CleanUp",
  Commit = "Commit",
  CurrentBranch = "CurrentBranch",
  Info = "Info",
  Ignore = "Ignore",
  Log = "Log",
  NewBranch = "NewBranch",
  Patch = "Patch",
  Remove = "Remove",
  RemoveChangelist = "RemoveChangelist",
  Rename = "Rename",
  Resolve = "Resolve",
  Resolved = "Resolved",
  Revert = "Revert",
  Show = "Show",
  Status = "Status",
  StatusRemote = "StatusRemote",
  SwitchBranch = "SwitchBranch",
  Update = "Update",
  Info = "Info"
}

export interface ISvnResourceGroup extends SourceControlResourceGroup {
  resourceStates: Resource[];
  repository?: Repository;
}

export interface IWcStatus {
  locked: boolean;
  switched: boolean;
}

export interface IFileStatus {
  status: string;
  props: string;
  path: string;
  changelist?: string;
  rename?: string;
  wcStatus: IWcStatus;
  commit?: {
    revision: string;
    author: string;
    date: string;
  };
  repositoryUuid?: string;
  reposStatus?: {
    props: string;
    item: string;
  };
  [key: number]: IFileStatus;
}

export interface IEntry {
  path: string;
  wcStatus: {
    item: string;
    revision: string;
    props: string;
    movedTo?: string;
    movedFrom?: string;
    wcLocked?: string;
    switched?: string;
    commit: {
      revision: string;
      author: string;
      date: string;
    };
  };
  reposStatus?: {
    props: string;
    item: string;
  };
}

export enum Status {
  ADDED = "added",
  CONFLICTED = "conflicted",
  DELETED = "deleted",
  EXTERNAL = "external",
  IGNORED = "ignored",
  INCOMPLETE = "incomplete",
  MERGED = "merged",
  MISSING = "missing",
  MODIFIED = "modified",
  NONE = "none",
  NORMAL = "normal",
  OBSTRUCTED = "obstructed",
  REPLACED = "replaced",
  UNVERSIONED = "unversioned"
}

export enum PropStatus {
  CONFLICTED = "conflicted",
  MODIFIED = "modified",
  NONE = "none",
  NORMAL = "normal"
}

export interface ICpOptions extends SpawnOptions {
  cwd?: string;
  encoding?: string;
  log?: boolean;
  username?: string;
  password?: string;
}

export interface ISvnErrorData {
  error?: Error;
  message?: string;
  stdout?: string;
  stderr?: string;
  stderrFormated?: string;
  exitCode?: number;
  svnErrorCode?: string;
  svnCommand?: string;
}

export interface ISvnOptions {
  svnPath: string;
  version: string;
}

export interface IExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ICacheRow {
  uri: Uri;
  timestamp: number;
}

export interface ICache {
  [uri: string]: ICacheRow;
}

export interface ISvn {
  path: string;
  version: string;
}

export enum SvnUriAction {
  LOG = "LOG",
  PATCH = "PATCH",
  SHOW = "SHOW"
}

export interface ISvnUriExtraParams {
  ref?: string;
  limit?: string;
  [key: string]: any;
}

export interface ISvnUriParams {
  action: SvnUriAction;
  fsPath: string;
  extra: ISvnUriExtraParams;
}

export interface IDisposable {
  dispose(): void;
}

export interface IOperations {
  isIdle(): boolean;
  isRunning(operation: Operation): boolean;
}

export interface IAuth {
  username: string;
  password: string;
}

export interface ISvnLogEntryPath {
  /** full path from repo root */
  _: string;
  /** A | D | M | R */
  action: string;
  /** "file" | "dir" e.g. */
  kind: string;
}

/** produced by svn log */
export interface ISvnLogEntry {
  revision: string;
  author: string;
  date: string;
  msg: string;
  paths: ISvnLogEntryPath[];
}
