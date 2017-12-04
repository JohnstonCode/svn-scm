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
  window
} from "vscode";
import { Resource } from "./resource";
import { throttle, debounce } from "./decorators";
import { Repository as BaseRepository } from "./svnRepository";
import { SvnStatusBar } from "./statusBar";
import { dispose, anyEvent, filterEvent, toDisposable } from "./util";
import * as path from "path";
import { setInterval, clearInterval } from "timers";

export class Repository {
  public watcher: FileSystemWatcher;
  public sourceControl: SourceControl;
  public changes: SourceControlResourceGroup;
  public notTracked: SourceControlResourceGroup;
  private disposables: Disposable[] = [];
  public currentBranch = "";
  public isSwitchingBranch: boolean = false;
  public branches: any[] = [];
  public branchesTimer: NodeJS.Timer;

  private _onDidChangeRepository = new EventEmitter<Uri>();
  readonly onDidChangeRepository: Event<Uri> = this._onDidChangeRepository
    .event;

  private _onDidChangeStatus = new EventEmitter<void>();
  readonly onDidChangeStatus: Event<void> = this._onDidChangeStatus.event;

  get root(): string {
    return this.repository.root;
  }

  get workspaceRoot(): string {
    return this.repository.workspaceRoot;
  }

  get inputBox(): SourceControlInputBox {
    return this.sourceControl.inputBox;
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
      uri => !/\/\.svn\/tmp/.test(uri.path)
    );
    onRelevantRepositoryChange(this.update, this, this.disposables);

    const onRelevantSvnChange = filterEvent(onRelevantRepositoryChange, uri =>
      /\/\.svn\//.test(uri.path)
    );
    onRelevantSvnChange(
      this._onDidChangeRepository.fire,
      this._onDidChangeRepository,
      this.disposables
    );

    this.sourceControl = scm.createSourceControl(
      "svn",
      "SVN",
      Uri.file(repository.root)
    );
    this.sourceControl.acceptInputCommand = {
      command: "svn.commitWithMessage",
      title: "commit",
      arguments: [this.sourceControl]
    };
    this.sourceControl.quickDiffProvider = this;
    this.disposables.push(this.sourceControl);

    const statusBar = new SvnStatusBar(this);
    this.disposables.push(statusBar);
    statusBar.onDidChange(
      () => (this.sourceControl.statusBarCommands = statusBar.commands),
      null,
      this.disposables
    );
    this.onDidChangeRepository(
      () => (this.sourceControl.statusBarCommands = statusBar.commands),
      null,
      this.disposables
    );
    this.sourceControl.statusBarCommands = statusBar.commands;

    this.changes = this.sourceControl.createResourceGroup("changes", "Changes");
    this.notTracked = this.sourceControl.createResourceGroup(
      "unversioned",
      "Not Tracked"
    );

    this.changes.hideWhenEmpty = true;
    this.notTracked.hideWhenEmpty = true;

    this.disposables.push(
      toDisposable(() => clearInterval(this.branchesTimer))
    );
    setInterval(() => {
      this.updateBranches();
    }, 1000 * 60 * 5); // 5 minutes

    this.updateBranches();
    this.update();
  }

  @debounce(1000)
  async updateBranches() {
    try {
      this.branches = await this.repository.getBranches();
    } catch (error) {
      console.error(error);
    }
  }

  @debounce(1000)
  async update() {
    let changes: any[] = [];
    let notTracked: any[] = [];
    let statuses = (await this.repository.getStatus()) || [];

    statuses.forEach(status => {
      switch (status[0]) {
        case "A":
          changes.push(new Resource(this.workspaceRoot, status[1], "added"));
          break;
        case "D":
          changes.push(new Resource(this.workspaceRoot, status[1], "deleted"));
          break;
        case "M":
          changes.push(new Resource(this.workspaceRoot, status[1], "modified"));
          break;
        case "R":
          changes.push(new Resource(this.workspaceRoot, status[1], "replaced"));
          break;
        case "!":
          changes.push(new Resource(this.workspaceRoot, status[1], "missing"));
          break;
        case "C":
          changes.push(new Resource(this.workspaceRoot, status[1], "conflict"));
          break;
        case "?":
          notTracked.push(
            new Resource(this.workspaceRoot, status[1], "unversioned")
          );
          break;
      }
    });

    this.changes.resourceStates = changes;
    this.notTracked.resourceStates = notTracked;

    this.currentBranch = await this.getCurrentBranch();

    this._onDidChangeStatus.fire();

    return Promise.resolve();
  }

  provideOriginalResource(uri: Uri): Uri | undefined {
    if (uri.scheme !== "file") {
      return;
    }

    return uri.with({ scheme: "svn", query: uri.path, path: uri.path });
  }

  show(filePath: string, revision?: string): Promise<string> {
    return this.repository.show(filePath, revision);
  }

  addFile(filePath: string) {
    return this.repository.addFile(filePath);
  }

  dispose(): void {
    this.disposables = dispose(this.disposables);
  }

  getCurrentBranch() {
    return this.repository.getCurrentBranch();
  }

  async branch(name: string) {
    this.isSwitchingBranch = true;
    this._onDidChangeRepository.fire();
    const response = await this.repository.branch(name);
    this.isSwitchingBranch = false;
    this.updateBranches();
    this._onDidChangeRepository.fire();
    return response;
  }

  async switchBranch(name: string) {
    this.isSwitchingBranch = true;
    this._onDidChangeRepository.fire();

    try {
      const response = await this.repository.switchBranch(name);
    } catch (error) {
      if (/E195012/.test(error)) {
        window.showErrorMessage(
          `Path '${
            this.workspaceRoot
          }' does not share common version control ancestry with the requested switch location.`
        );
        return;
      }

      window.showErrorMessage("Unable to switch branch");
    } finally {
      this.isSwitchingBranch = false;
      this.updateBranches();
      this._onDidChangeRepository.fire();
    }
  }
}
