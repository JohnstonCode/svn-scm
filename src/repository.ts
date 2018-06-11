import {
  Uri,
  scm,
  workspace,
  FileSystemWatcher,
  SourceControl,
  SourceControlResourceGroup,
  SourceControlInputBox,
  Disposable,
  EventEmitter,
  Event,
  window,
  ProgressLocation,
  commands,
  TextDocument
} from "vscode";
import { Resource, SvnResourceGroup } from "./resource";
import { throttle, debounce, memoize, sequentialize } from "./decorators";
import { Repository as BaseRepository } from "./svnRepository";
import { SvnStatusBar } from "./statusBar";
import {
  dispose,
  anyEvent,
  filterEvent,
  toDisposable,
  timeout,
  eventToPromise,
  isDescendant
} from "./util";
import * as path from "path";
import { setInterval, clearInterval } from "timers";
import { toSvnUri, SvnUriAction } from "./uri";
import { Status, PropStatus, SvnErrorCodes } from "./svn";
import { IFileStatus } from "./statusParser";
import { configuration } from "./helpers/configuration";
import { Minimatch } from "minimatch";

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
  Ignore = "Ignore",
  Log = "Log",
  NewBranch = "NewBranch",
  NewCommits = "NewCommits",
  Patch = "Patch",
  Remove = "Remove",
  RemoveChangelist = "RemoveChangelist",
  Rename = "Rename",
  Resolve = "Resolve",
  Resolved = "Resolved",
  Revert = "Revert",
  Show = "Show",
  Status = "Status",
  SwitchBranch = "SwitchBranch",
  Update = "Update"
}

function isReadOnly(operation: Operation): boolean {
  switch (operation) {
    case Operation.CurrentBranch:
    case Operation.Log:
    case Operation.NewCommits:
    case Operation.Show:
      return true;
    default:
      return false;
  }
}

function shouldShowProgress(operation: Operation): boolean {
  switch (operation) {
    case Operation.CurrentBranch:
    case Operation.NewCommits:
    case Operation.Show:
      return false;
    default:
      return true;
  }
}

export interface Operations {
  isIdle(): boolean;
  isRunning(operation: Operation): boolean;
}

class OperationsImpl implements Operations {
  private operations = new Map<Operation, number>();

  start(operation: Operation): void {
    this.operations.set(operation, (this.operations.get(operation) || 0) + 1);
  }

  end(operation: Operation): void {
    const count = (this.operations.get(operation) || 0) - 1;

    if (count <= 0) {
      this.operations.delete(operation);
    } else {
      this.operations.set(operation, count);
    }
  }

  isRunning(operation: Operation): boolean {
    return this.operations.has(operation);
  }

  isIdle(): boolean {
    const operations = this.operations.keys();

    for (const operation of operations) {
      if (!isReadOnly(operation)) {
        return false;
      }
    }

    return true;
  }
}

export class Repository {
  public sourceControl: SourceControl;
  public statusBar: SvnStatusBar;
  public changes: SvnResourceGroup;
  public unversioned: SvnResourceGroup;
  public changelists: Map<string, SvnResourceGroup> = new Map();
  public conflicts: SvnResourceGroup;
  public statusIgnored: IFileStatus[] = [];
  public statusExternal: IFileStatus[] = [];
  private disposables: Disposable[] = [];
  public currentBranch = "";
  public newCommit: number = 0;
  public isIncomplete: boolean = false;
  public needCleanUp: boolean = false;

  private lastPromptAuth?: Thenable<boolean | undefined>;

  private _onDidChangeRepository = new EventEmitter<Uri>();
  readonly onDidChangeRepository: Event<Uri> = this._onDidChangeRepository
    .event;

  private _onDidChangeState = new EventEmitter<RepositoryState>();
  readonly onDidChangeState: Event<RepositoryState> = this._onDidChangeState
    .event;

  private _onDidChangeStatus = new EventEmitter<void>();
  readonly onDidChangeStatus: Event<void> = this._onDidChangeStatus.event;

  private _onDidChangeNewCommit = new EventEmitter<void>();
  readonly onDidChangeNewCommit: Event<void> = this._onDidChangeNewCommit.event;

  private _onRunOperation = new EventEmitter<Operation>();
  readonly onRunOperation: Event<Operation> = this._onRunOperation.event;

  private _onDidRunOperation = new EventEmitter<Operation>();
  readonly onDidRunOperation: Event<Operation> = this._onDidRunOperation.event;

  @memoize
  get onDidChangeOperations(): Event<void> {
    return anyEvent(
      this.onRunOperation as Event<any>,
      this.onDidRunOperation as Event<any>
    );
  }

  private _operations = new OperationsImpl();
  get operations(): Operations {
    return this._operations;
  }

  private _state = RepositoryState.Idle;
  get state(): RepositoryState {
    return this._state;
  }
  set state(state: RepositoryState) {
    this._state = state;
    this._onDidChangeState.fire(state);

    this.changes.resourceStates = [];
    this.unversioned.resourceStates = [];
    this.conflicts.resourceStates = [];
    this.changelists.forEach((group, changelist) => {
      group.resourceStates = [];
    });

    this.isIncomplete = false;
    this.needCleanUp = false;
  }
  get root(): string {
    return this.repository.root;
  }

  get workspaceRoot(): string {
    return this.repository.workspaceRoot;
  }

  get inputBox(): SourceControlInputBox {
    return this.sourceControl.inputBox;
  }

  get username(): string | undefined {
    return this.repository.username;
  }

  set username(username: string | undefined) {
    this.repository.username = username;
  }

  get password(): string | undefined {
    return this.repository.password;
  }

  set password(password: string | undefined) {
    this.repository.password = password;
  }

  constructor(public repository: BaseRepository) {
    const fsWatcher = workspace.createFileSystemWatcher("**");
    this.disposables.push(fsWatcher);

    const onWorkspaceChange = anyEvent(
      fsWatcher.onDidChange,
      fsWatcher.onDidCreate,
      fsWatcher.onDidDelete
    );

    const onRepositoryChange = filterEvent(
      onWorkspaceChange,
      uri => !/^\.\./.test(path.relative(repository.root, uri.fsPath))
    );
    const onRelevantRepositoryChange = filterEvent(
      onRepositoryChange,
      uri => !/[\\\/]\.svn[\\\/]tmp/.test(uri.path)
    );

    onRelevantRepositoryChange(this.onFSChange, this, this.disposables);

    const onRelevantSvnChange = filterEvent(onRelevantRepositoryChange, uri =>
      /[\\\/]\.svn[\\\/]/.test(uri.path)
    );

    onRelevantSvnChange(
      this._onDidChangeRepository.fire,
      this._onDidChangeRepository,
      this.disposables
    );

    this.sourceControl = scm.createSourceControl(
      "svn",
      "SVN",
      Uri.file(repository.workspaceRoot)
    );

    this.sourceControl.count = 0;
    this.sourceControl.acceptInputCommand = {
      command: "svn.commitWithMessage",
      title: "commit",
      arguments: [this.sourceControl]
    };
    this.sourceControl.quickDiffProvider = this;
    this.disposables.push(this.sourceControl);

    this.statusBar = new SvnStatusBar(this);
    this.disposables.push(this.statusBar);
    this.statusBar.onDidChange(
      () => (this.sourceControl.statusBarCommands = this.statusBar.commands),
      null,
      this.disposables
    );

    this.changes = this.sourceControl.createResourceGroup(
      "changes",
      "Changes"
    ) as SvnResourceGroup;
    this.conflicts = this.sourceControl.createResourceGroup(
      "conflicts",
      "conflicts"
    ) as SvnResourceGroup;
    this.unversioned = this.sourceControl.createResourceGroup(
      "unversioned",
      "Unversioned"
    ) as SvnResourceGroup;

    this.changes.hideWhenEmpty = true;
    this.unversioned.hideWhenEmpty = true;
    this.conflicts.hideWhenEmpty = true;

    this.disposables.push(this.changes);
    this.disposables.push(this.unversioned);
    this.disposables.push(this.conflicts);

    const updateFreqNew = configuration.get<number>(
      "newCommits.checkFrequency"
    );
    if (updateFreqNew) {
      const interval = setInterval(() => {
        this.updateNewCommits();
      }, 1000 * 60 * updateFreqNew);

      this.disposables.push(
        toDisposable(() => {
          clearInterval(interval);
        })
      );
    }

    this.status();
    this.updateNewCommits();

    this.disposables.push(
      workspace.onDidSaveTextDocument(document => {
        this.onDidSaveTextDocument(document);
      })
    );
  }

  @debounce(1000)
  async updateNewCommits() {
    this.run(Operation.NewCommits, async () => {
      const newCommits = await this.repository.countNewCommit();
      if (newCommits !== this.newCommit) {
        this.newCommit = newCommits;
        this._onDidChangeNewCommit.fire();
      }
    });
  }

  private onFSChange(uri: Uri): void {
    const autorefresh = configuration.get<boolean>("autorefresh");

    if (!autorefresh) {
      return;
    }

    if (!this.operations.isIdle()) {
      return;
    }

    this.eventuallyUpdateWhenIdleAndWait();
  }

  @debounce(1000)
  private eventuallyUpdateWhenIdleAndWait(): void {
    this.updateWhenIdleAndWait();
  }

  @throttle
  private async updateWhenIdleAndWait(): Promise<void> {
    await this.whenIdleAndFocused();
    await this.status();
    await timeout(5000);
  }

  async whenIdleAndFocused(): Promise<void> {
    while (true) {
      if (!this.operations.isIdle()) {
        await eventToPromise(this.onDidRunOperation);
        continue;
      }

      if (!window.state.focused) {
        const onDidFocusWindow = filterEvent(
          window.onDidChangeWindowState,
          e => e.focused
        );
        await eventToPromise(onDidFocusWindow);
        continue;
      }

      return;
    }
  }

  @throttle
  async updateModelState() {
    let changes: any[] = [];
    let unversioned: any[] = [];
    let external: any[] = [];
    let conflicts: any[] = [];
    let changelists: Map<string, Resource[]> = new Map();

    this.statusExternal = [];
    this.statusIgnored = [];
    this.isIncomplete = false;
    this.needCleanUp = false;

    const combineExternal = configuration.get<boolean>(
      "sourceControl.combineExternalIfSameServer",
      false
    );

    const statuses =
      (await this.repository.getStatus(true, combineExternal)) || [];

    const fileConfig = workspace.getConfiguration("files", Uri.file(this.root));

    const filesToExclude = fileConfig.get<any>("exclude");

    let excludeList: string[] = [];
    for (const pattern in filesToExclude) {
      const negate = !filesToExclude[pattern];
      excludeList.push((negate ? "!" : "") + pattern);
    }

    this.statusExternal = statuses.filter(
      status => status.status === Status.EXTERNAL
    );

    if (combineExternal && this.statusExternal.length) {
      const repositoryUuid = await this.repository.getRepositoryUuid();
      this.statusExternal = this.statusExternal.filter(
        status => repositoryUuid !== status.repositoryUuid
      );
    }

    const statusesRepository = statuses.filter(status => {
      if (status.status === Status.EXTERNAL) {
        return false;
      }

      return !this.statusExternal.some(external =>
        isDescendant(external.path, status.path)
      );
    });

    for (const status of statusesRepository) {
      if (status.path === ".") {
        this.isIncomplete = status.status === Status.INCOMPLETE;
        this.needCleanUp = status.wcStatus.locked;
        continue;
      }

      // If exists a switched item, the repository is incomplete
      // To simulate, run "svn switch" and kill "svn" proccess
      // After, run "svn update"
      if (status.wcStatus.switched) {
        this.isIncomplete = true;
      }

      if (
        status.wcStatus.locked ||
        status.wcStatus.switched ||
        status.status === Status.INCOMPLETE
      ) {
        // On commit, `svn status` return all locked files with status="normal" and props="none"
        continue;
      }

      const mm = new Minimatch("*");
      if (mm.matchOne([status.path], excludeList, false)) {
        continue;
      }

      const uri = Uri.file(path.join(this.workspaceRoot, status.path));
      const renameUri = status.rename
        ? Uri.file(path.join(this.workspaceRoot, status.rename))
        : undefined;

      const resource = new Resource(
        uri,
        status.status,
        renameUri,
        status.props
      );

      if (status.status === Status.IGNORED) {
        this.statusIgnored.push(status);
      } else if (status.status === Status.CONFLICTED) {
        conflicts.push(resource);
      } else if (status.status === Status.UNVERSIONED) {
        const matches = status.path.match(
          /(.+?)\.(mine|working|merge-\w+\.r\d+|r\d+)$/
        );

        // If file end with (mine, working, merge, etc..) and has file without extension
        if (
          matches &&
          matches[1] &&
          statuses.some(s => s.path === matches[1])
        ) {
          continue;
        } else {
          unversioned.push(resource);
        }
      } else {
        if (!status.changelist) {
          changes.push(resource);
        } else {
          let changelist = changelists.get(status.changelist);
          if (!changelist) {
            changelist = [];
          }
          changelist.push(resource);
          changelists.set(status.changelist, changelist);
        }
      }
    }

    this.changes.resourceStates = changes;
    this.unversioned.resourceStates = unversioned;
    this.conflicts.resourceStates = conflicts;

    this.changelists.forEach((group, changelist) => {
      group.resourceStates = [];
    });

    const counts = [this.changes, this.conflicts];

    const countIgnoreOnCommit = configuration.get<boolean>(
      "sourceControl.countIgnoreOnCommit",
      false
    );
    const ignoreOnCommitList = configuration.get<string[]>(
      "sourceControl.ignoreOnCommit"
    );

    changelists.forEach((resources, changelist) => {
      let group = this.changelists.get(changelist);
      if (!group) {
        // Prefix 'changelist-' to prevent double id with 'change' or 'external'
        group = this.sourceControl.createResourceGroup(
          `changelist-${changelist}`,
          `Changelist "${changelist}"`
        ) as SvnResourceGroup;
        group.hideWhenEmpty = true;
        this.disposables.push(group);

        this.changelists.set(changelist, group);
      }

      group.resourceStates = resources;

      if (countIgnoreOnCommit && ignoreOnCommitList.includes(changelist)) {
        counts.push(group);
      }
    });

    if (configuration.get<boolean>("sourceControl.countUnversioned", false)) {
      counts.push(this.unversioned);
    }

    this.sourceControl.count = counts.reduce(
      (a, b) => a + b.resourceStates.length,
      0
    );

    this._onDidChangeStatus.fire();

    this.currentBranch = await this.getCurrentBranch();

    return Promise.resolve();
  }

  public getResourceFromFile(uri: string | Uri): Resource | undefined {
    if (typeof uri === "string") {
      uri = Uri.file(uri);
    }

    const groups = [
      this.changes,
      this.conflicts,
      this.unversioned,
      ...this.changelists.values()
    ];

    const uriString = uri.toString();

    for (const group of groups) {
      for (const resource of group.resourceStates) {
        if (
          uriString === resource.resourceUri.toString() &&
          resource instanceof Resource
        ) {
          return resource;
        }
      }
    }

    return undefined;
  }

  provideOriginalResource(uri: Uri): Uri | undefined {
    if (uri.scheme !== "file") {
      return;
    }

    // Not has original resource for content of ".svn" folder
    if (isDescendant(path.join(this.root, ".svn"), uri.fsPath)) {
      return;
    }

    return toSvnUri(uri, SvnUriAction.SHOW, {}, true);
  }

  async getBranches() {
    try {
      return await this.repository.getBranches();
    } catch (error) {
      return [];
    }
  }

  @throttle
  async status() {
    return this.run(Operation.Status);
  }

  async show(filePath: string, revision?: string): Promise<string> {
    return this.run<string>(Operation.Show, () => {
      return this.repository.show(filePath, revision);
    });
  }

  async addFiles(files: string[]) {
    return await this.run(Operation.Add, () => this.repository.addFiles(files));
  }

  async addChangelist(files: string[], changelist: string) {
    return await this.run(Operation.AddChangelist, () =>
      this.repository.addChangelist(files, changelist)
    );
  }

  async removeChangelist(files: string[]) {
    return await this.run(Operation.RemoveChangelist, () =>
      this.repository.removeChangelist(files)
    );
  }

  async getCurrentBranch() {
    return await this.run(Operation.CurrentBranch, async () => {
      return this.repository.getCurrentBranch();
    });
  }

  async branch(name: string) {
    return await this.run(Operation.NewBranch, async () => {
      await this.repository.branch(name);
      this.updateNewCommits();
    });
  }

  async switchBranch(name: string) {
    await this.run(Operation.SwitchBranch, async () => {
      await this.repository.switchBranch(name);
      this.updateNewCommits();
    });
  }

  async updateRevision(ignoreExternals: boolean = false): Promise<string> {
    return await this.run<string>(Operation.Update, async () => {
      const response = await this.repository.update(ignoreExternals);
      this.updateNewCommits();
      return response;
    });
  }

  async resolve(files: string[], action: string) {
    return await this.run(Operation.Resolve, () =>
      this.repository.resolve(files, action)
    );
  }

  async commitFiles(message: string, files: any[]) {
    return await this.run(Operation.Commit, () =>
      this.repository.commitFiles(message, files)
    );
  }

  async revert(files: string[]) {
    return await this.run(Operation.Revert, () =>
      this.repository.revert(files)
    );
  }

  async patch(files: string[]) {
    return await this.run(Operation.Patch, () => this.repository.patch(files));
  }

  async patchChangelist(changelistName: string) {
    return await this.run(Operation.Patch, () =>
      this.repository.patchChangelist(changelistName)
    );
  }

  async removeFiles(files: any[], keepLocal: boolean) {
    return await this.run(Operation.Remove, () =>
      this.repository.removeFiles(files, keepLocal)
    );
  }

  async log() {
    return await this.run(Operation.Log, () => this.repository.log());
  }

  async cleanup() {
    return await this.run(Operation.CleanUp, () => this.repository.cleanup());
  }

  async finishCheckout() {
    return await this.run(Operation.SwitchBranch, () =>
      this.repository.finishCheckout()
    );
  }

  async addToIgnore(
    expressions: string[],
    directory: string,
    recursive: boolean = false
  ) {
    return await this.run(Operation.Ignore, () =>
      this.repository.addToIgnore(expressions, directory, recursive)
    );
  }

  async rename(oldFile: string, newFile: string) {
    return await this.run(Operation.Rename, () =>
      this.repository.rename(oldFile, newFile)
    );
  }

  async promptAuth(): Promise<boolean | undefined> {
    // Prevent multiple prompts for auth
    if (this.lastPromptAuth) {
      return await this.lastPromptAuth;
    }

    this.lastPromptAuth = commands.executeCommand("svn.promptAuth");
    const result = await this.lastPromptAuth;
    this.lastPromptAuth = undefined;
    return result;
  }

  onDidSaveTextDocument(document: TextDocument) {
    const uriString = document.uri.toString();
    const conflict = this.conflicts.resourceStates.find(
      resource => resource.resourceUri.toString() === uriString
    );
    if (!conflict) {
      return;
    }

    const text = document.getText();

    // Check for lines begin with "<<<<<<", "=======", ">>>>>>>"
    if (!/^<{7}[^]+^={7}[^]+^>{7}/m.test(text)) {
      commands.executeCommand("svn.resolved", conflict.resourceUri);
    }
  }

  private async run<T>(
    operation: Operation,
    runOperation: () => Promise<T> = () => Promise.resolve<any>(null)
  ): Promise<T> {
    if (this.state !== RepositoryState.Idle) {
      throw new Error("Repository not initialized");
    }

    const run = async () => {
      this._operations.start(operation);
      this._onRunOperation.fire(operation);

      try {
        const result = await this.retryRun(runOperation);

        if (!isReadOnly(operation)) {
          await this.updateModelState();
        }

        return result;
      } catch (err) {
        if (err.svnErrorCode === SvnErrorCodes.NotASvnRepository) {
          this.state = RepositoryState.Disposed;
        }

        throw err;
      } finally {
        this._operations.end(operation);
        this._onDidRunOperation.fire(operation);
      }
    };

    return shouldShowProgress(operation)
      ? window.withProgress({ location: ProgressLocation.SourceControl }, run)
      : run();
  }

  private async retryRun<T>(
    runOperation: () => Promise<T> = () => Promise.resolve<any>(null)
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        attempt++;
        return await runOperation();
      } catch (err) {
        if (
          err.svnErrorCode === SvnErrorCodes.RepositoryIsLocked &&
          attempt <= 10
        ) {
          // quatratic backoff
          await timeout(Math.pow(attempt, 2) * 50);
        } else if (
          err.svnErrorCode === SvnErrorCodes.AuthorizationFailed &&
          attempt <= 3
        ) {
          const result = await this.promptAuth();
          if (!result) {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
  }

  dispose(): void {
    this.disposables = dispose(this.disposables);
  }
}
