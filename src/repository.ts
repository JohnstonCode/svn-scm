import { Minimatch } from "minimatch";
import * as path from "path";
import { clearInterval, setInterval } from "timers";
import {
  commands,
  Disposable,
  Event,
  EventEmitter,
  ProgressLocation,
  scm,
  SourceControl,
  SourceControlInputBox,
  TextDocument,
  Uri,
  window,
  workspace
} from "vscode";
import {
  IFileStatus,
  IOperations,
  ISvnResourceGroup,
  Operation,
  RepositoryState,
  Status,
  SvnUriAction
} from "./common/types";
import { debounce, memoize, throttle } from "./decorators";
import { configuration } from "./helpers/configuration";
import OperationsImpl from "./operationsImpl";
import { Resource } from "./resource";
import { SvnStatusBar } from "./statusBar";
import { svnErrorCodes } from "./svn";
import { Repository as BaseRepository } from "./svnRepository";
import { toSvnUri } from "./uri";
import {
  anyEvent,
  dispose,
  eventToPromise,
  filterEvent,
  isDescendant,
  isReadOnly,
  timeout,
  toDisposable
} from "./util";

function shouldShowProgress(operation: Operation): boolean {
  switch (operation) {
    case Operation.CurrentBranch:
    case Operation.Show:
      return false;
    default:
      return true;
  }
}

export class Repository {
  public sourceControl: SourceControl;
  public statusBar: SvnStatusBar;
  public changes: ISvnResourceGroup;
  public unversioned: ISvnResourceGroup;
  public remoteChanged?: ISvnResourceGroup;
  public changelists: Map<string, ISvnResourceGroup> = new Map();
  public conflicts: ISvnResourceGroup;
  public statusIgnored: IFileStatus[] = [];
  public statusExternal: IFileStatus[] = [];
  private disposables: Disposable[] = [];
  public currentBranch = "";
  public remoteChangedFiles: number = 0;
  public isIncomplete: boolean = false;
  public needCleanUp: boolean = false;

  private lastPromptAuth?: Thenable<boolean | undefined>;

  private _onDidChangeRepository = new EventEmitter<Uri>();
  public readonly onDidChangeRepository: Event<Uri> = this
    ._onDidChangeRepository.event;

  private _onDidChangeState = new EventEmitter<RepositoryState>();
  public readonly onDidChangeState: Event<RepositoryState> = this
    ._onDidChangeState.event;

  private _onDidChangeStatus = new EventEmitter<void>();
  public readonly onDidChangeStatus: Event<void> = this._onDidChangeStatus
    .event;

  private _onDidChangeRemoteChangedFiles = new EventEmitter<void>();
  public readonly onDidChangeRemoteChangedFile: Event<void> = this
    ._onDidChangeRemoteChangedFiles.event;

  private _onRunOperation = new EventEmitter<Operation>();
  public readonly onRunOperation: Event<Operation> = this._onRunOperation.event;

  private _onDidRunOperation = new EventEmitter<Operation>();
  public readonly onDidRunOperation: Event<Operation> = this._onDidRunOperation
    .event;

  @memoize
  get onDidChangeOperations(): Event<void> {
    return anyEvent(
      this.onRunOperation as Event<any>,
      this.onDidRunOperation as Event<any>
    );
  }

  private _operations = new OperationsImpl();
  get operations(): IOperations {
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

    if (this.remoteChanged) {
      this.remoteChanged.dispose();
    }

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
    this.sourceControl.inputBox.placeholder =
      "Message (press Ctrl+Enter to commit)";
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
    ) as ISvnResourceGroup;
    this.conflicts = this.sourceControl.createResourceGroup(
      "conflicts",
      "conflicts"
    ) as ISvnResourceGroup;
    this.unversioned = this.sourceControl.createResourceGroup(
      "unversioned",
      "Unversioned"
    ) as ISvnResourceGroup;

    this.changes.hideWhenEmpty = true;
    this.unversioned.hideWhenEmpty = true;
    this.conflicts.hideWhenEmpty = true;

    this.disposables.push(this.changes);
    this.disposables.push(this.unversioned);
    this.disposables.push(this.conflicts);

    const updateFreqNew = configuration.get<number>(
      "remoteChanges.checkFrequency",
      300
    );
    if (updateFreqNew) {
      const interval = setInterval(() => {
        this.updateRemoteChangedFiles();
      }, 1000 * updateFreqNew);

      this.disposables.push(
        toDisposable(() => {
          clearInterval(interval);
        })
      );
    }

    this.status();

    if (updateFreqNew) {
      this.updateRemoteChangedFiles();
    }

    this.disposables.push(
      workspace.onDidSaveTextDocument(document => {
        this.onDidSaveTextDocument(document);
      })
    );
  }

  @debounce(1000)
  public async updateRemoteChangedFiles() {
    this.run(Operation.StatusRemote);
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

  public async whenIdleAndFocused(): Promise<void> {
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
  public async updateModelState(checkRemoteChanges: boolean = false) {
    const changes: any[] = [];
    const unversioned: any[] = [];
    const external: any[] = [];
    const conflicts: any[] = [];
    const changelists: Map<string, Resource[]> = new Map();
    const remoteChanged: any[] = [];

    this.statusExternal = [];
    this.statusIgnored = [];
    this.isIncomplete = false;
    this.needCleanUp = false;

    const combineExternal = configuration.get<boolean>(
      "sourceControl.combineExternalIfSameServer",
      false
    );

    const statuses =
      (await this.repository.getStatus({
        includeIgnored: true,
        includeExternals: combineExternal,
        checkRemoteChanges
      })) || [];
    const fileConfig = workspace.getConfiguration("files", Uri.file(this.root));

    const filesToExclude = fileConfig.get<any>("exclude");

    const excludeList: string[] = [];
    for (const pattern in filesToExclude) {
      if (filesToExclude.hasOwnProperty(pattern)) {
        const negate = !filesToExclude[pattern];
        excludeList.push((negate ? "!" : "") + pattern);
      }
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

    const hideUnversioned = configuration.get<boolean>(
      "sourceControl.hideUnversioned"
    );

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

      if (status.reposStatus) {
        remoteChanged.push(
          new Resource(
            uri,
            status.reposStatus.item,
            undefined,
            status.reposStatus.props,
            true
          )
        );
      }

      const resource = new Resource(
        uri,
        status.status,
        renameUri,
        status.props
      );

      if (
        status.status === Status.NORMAL &&
        (status.props === Status.NORMAL || status.props === Status.NONE)
      ) {
        // Ignore non changed itens
        continue;
      } else if (status.status === Status.IGNORED) {
        this.statusIgnored.push(status);
      } else if (status.status === Status.CONFLICTED) {
        conflicts.push(resource);
      } else if (status.status === Status.UNVERSIONED) {
        const matches = status.path.match(
          /(.+?)\.(mine|working|merge-\w+\.r\d+|r\d+)$/
        );

        // If file end with (mine, working, merge, etc..), has file without extension and
        // sourceControl.hideUnversioned flag is turned on.
        if (hideUnversioned) { continue; }
        if (
          matches &&
          matches[1] &&
          statuses.some(s => s.path === matches[1]) &&
          hideUnversioned
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
        ) as ISvnResourceGroup;
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

    if (checkRemoteChanges) {
      /**
       * Destroy and create for keep at last position
       */
      if (this.remoteChanged) {
        this.remoteChanged.dispose();
      }
      this.remoteChanged = this.sourceControl.createResourceGroup(
        "remotechanged",
        "Remote Changes"
      ) as ISvnResourceGroup;
      this.remoteChanged.hideWhenEmpty = true;
      this.remoteChanged.resourceStates = remoteChanged;

      if (remoteChanged.length !== this.remoteChangedFiles) {
        this.remoteChangedFiles = remoteChanged.length;
        this._onDidChangeRemoteChangedFiles.fire();
      }
    }

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

  public provideOriginalResource(uri: Uri): Uri | undefined {
    if (uri.scheme !== "file") {
      return;
    }

    // Not has original resource for content of ".svn" folder
    if (isDescendant(path.join(this.root, ".svn"), uri.fsPath)) {
      return;
    }

    return toSvnUri(uri, SvnUriAction.SHOW, {}, true);
  }

  public async getBranches() {
    try {
      return await this.repository.getBranches();
    } catch (error) {
      return [];
    }
  }

  @throttle
  public async status() {
    return this.run(Operation.Status);
  }

  public async show(filePath: string, revision?: string): Promise<string> {
    return this.run<string>(Operation.Show, () => {
      return this.repository.show(filePath, revision);
    });
  }

  public async addFiles(files: string[]) {
    return this.run(Operation.Add, () => this.repository.addFiles(files));
  }

  public async addChangelist(files: string[], changelist: string) {
    return this.run(Operation.AddChangelist, () =>
      this.repository.addChangelist(files, changelist)
    );
  }

  public async removeChangelist(files: string[]) {
    return this.run(Operation.RemoveChangelist, () =>
      this.repository.removeChangelist(files)
    );
  }

  public async getCurrentBranch() {
    return this.run(Operation.CurrentBranch, async () => {
      return this.repository.getCurrentBranch();
    });
  }

  public async branch(name: string) {
    return this.run(Operation.NewBranch, async () => {
      await this.repository.branch(name);
      this.updateRemoteChangedFiles();
    });
  }

  public async switchBranch(name: string) {
    await this.run(Operation.SwitchBranch, async () => {
      await this.repository.switchBranch(name);
      this.updateRemoteChangedFiles();
    });
  }

  public async updateRevision(
    ignoreExternals: boolean = false
  ): Promise<string> {
    return this.run<string>(Operation.Update, async () => {
      const response = await this.repository.update(ignoreExternals);
      this.updateRemoteChangedFiles();
      return response;
    });
  }

  public async resolve(files: string[], action: string) {
    return this.run(Operation.Resolve, () =>
      this.repository.resolve(files, action)
    );
  }

  public async commitFiles(message: string, files: any[]) {
    return this.run(Operation.Commit, () =>
      this.repository.commitFiles(message, files)
    );
  }

  public async revert(files: string[]) {
    return this.run(Operation.Revert, () => this.repository.revert(files));
  }

  public async patch(files: string[]) {
    return this.run(Operation.Patch, () => this.repository.patch(files));
  }

  public async patchChangelist(changelistName: string) {
    return this.run(Operation.Patch, () =>
      this.repository.patchChangelist(changelistName)
    );
  }

  public async removeFiles(files: any[], keepLocal: boolean) {
    return this.run(Operation.Remove, () =>
      this.repository.removeFiles(files, keepLocal)
    );
  }

  public async log() {
    return this.run(Operation.Log, () => this.repository.log());
  }

  public async cleanup() {
    return this.run(Operation.CleanUp, () => this.repository.cleanup());
  }

  public async finishCheckout() {
    return this.run(Operation.SwitchBranch, () =>
      this.repository.finishCheckout()
    );
  }

  public async addToIgnore(
    expressions: string[],
    directory: string,
    recursive: boolean = false
  ) {
    return this.run(Operation.Ignore, () =>
      this.repository.addToIgnore(expressions, directory, recursive)
    );
  }

  public async rename(oldFile: string, newFile: string) {
    return this.run(Operation.Rename, () =>
      this.repository.rename(oldFile, newFile)
    );
  }

  public async promptAuth(): Promise<boolean | undefined> {
    // Prevent multiple prompts for auth
    if (this.lastPromptAuth) {
      return this.lastPromptAuth;
    }

    this.lastPromptAuth = commands.executeCommand("svn.promptAuth");
    const result = await this.lastPromptAuth;
    this.lastPromptAuth = undefined;
    return result;
  }

  public onDidSaveTextDocument(document: TextDocument) {
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

        const checkRemote = operation === Operation.StatusRemote;

        if (!isReadOnly(operation)) {
          await this.updateModelState(checkRemote);
        }

        return result;
      } catch (err) {
        if (err.svnErrorCode === svnErrorCodes.NotASvnRepository) {
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
          err.svnErrorCode === svnErrorCodes.RepositoryIsLocked &&
          attempt <= 10
        ) {
          // quatratic backoff
          await timeout(Math.pow(attempt, 2) * 50);
        } else if (
          err.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
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

  public dispose(): void {
    this.disposables = dispose(this.disposables);
  }
}
