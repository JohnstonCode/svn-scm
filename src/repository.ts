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
import * as micromatch from "micromatch";
import { setInterval, clearInterval } from "timers";
import { toSvnUri } from "./uri";
import { Status } from "./svn";

export class Repository {
  public watcher: FileSystemWatcher;
  public sourceControl: SourceControl;
  public changes: SourceControlResourceGroup;
  public changelist : { [key: string]: SourceControlResourceGroup } = {};
  public notTracked: SourceControlResourceGroup;
  public external: SourceControlResourceGroup;
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

  private _onDidChangeBranch = new EventEmitter<void>();
  readonly onDidChangeBranch: Event<void> = this._onDidChangeBranch.event;

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
      uri => !/[\\\/]\.svn[\\\/]tmp/.test(uri.path)
    );
    onRelevantRepositoryChange(this.update, this, this.disposables);

    const onRelevantSvnChange = filterEvent(onRelevantRepositoryChange, uri =>
      /[\\\/]\.svn[\\\/]/.test(uri.path)
    );

    onRelevantSvnChange(
      this._onDidChangeRepository.fire,
      this._onDidChangeRepository,
      this.disposables
    );

    this.onDidChangeRepository(
      async () => {
        if (!this.isSwitchingBranch) {
          this.currentBranch = await this.getCurrentBranch();
        }
      },
      null,
      this.disposables
    );

    this.sourceControl = scm.createSourceControl(
      "svn",
      "SVN",
      Uri.file(repository.workspaceRoot)
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

    const updateBranchName = async () => {
      this.currentBranch = await this.getCurrentBranch();
      this.sourceControl.statusBarCommands = statusBar.commands;
    };
    updateBranchName();

    this.changes = this.sourceControl.createResourceGroup("changes", "Changes");
    this.notTracked = this.sourceControl.createResourceGroup(
      "unversioned",
      "Not Tracked"
    );
    this.external = this.sourceControl.createResourceGroup(
      "external",
      "External"
    );

    this.changes.hideWhenEmpty = true;
    this.notTracked.hideWhenEmpty = true;
    this.external.hideWhenEmpty = true;

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
    let changelist: {[key:string]:Resource[]} = {};
    let notTracked: any[] = [];
    let external: any[] = [];
    const statuses = (await this.repository.getStatus()) || [];

    const fileConfig = workspace.getConfiguration("files");
    const svnConfig = workspace.getConfiguration("svn");

    const filesToExclude = fileConfig.get<any>("exclude", null);

    let excludeList: string[] = [];
    for (const pattern in filesToExclude) {
      const negate = !filesToExclude[pattern];
      excludeList.push((negate ? "!" : "") + pattern);
    }

    statuses.forEach(status => {
      if (micromatch.some(status.path, excludeList)) {
        return;
      }

      const uri = Uri.file(path.join(this.workspaceRoot, status.path));
      const renameUri = status.rename
        ? Uri.file(path.join(this.workspaceRoot, status.rename))
        : undefined;

      if (status.changelist){
        changelist[status.changelist] = changelist[status.changelist] || [];
        changelist[status.changelist].push(new Resource(uri, status.status, renameUri));
      } else if (status.status === Status.EXTERNAL) {
        external.push(new Resource(uri, status.status, renameUri));
      } else if (status.status === Status.UNVERSIONED) {
        const matches = status.path.match(
          /(.+?)\.(mine|working|merge-\w+\.r\d+|r\d+)$/
        );

        //If file end with (mine, working, merge, etc..) and has file without extension
        if (
          matches &&
          matches[1] &&
          statuses.some(s => s.path === matches[1])
        ) {
          return;
        }

        notTracked.push(new Resource(uri, status.status, renameUri));
      } else {
        changes.push(new Resource(uri, status.status, renameUri));
      }
    });

    this.changes.resourceStates = changes;
    this.notTracked.resourceStates = notTracked;

    for (const id in this.changelist) {
      this.changelist[id].resourceStates = [];
    }
    for (const id in changelist) {
      if(!this.changelist[id]){
        this.changelist[id] = this.sourceControl.createResourceGroup(id,id); 
        this.changelist[id].hideWhenEmpty = true;
      }
      this.changelist[id].resourceStates = changelist[id];
    }
    
    if (svnConfig.get<boolean>("sourceControl.showExternal")) {
      this.external.resourceStates = external;
    } else {
      this.external.resourceStates = [];
    }

    this.currentBranch = await this.getCurrentBranch();

    this._onDidChangeStatus.fire();

    return Promise.resolve();
  }

  provideOriginalResource(uri: Uri): Uri | undefined {
    if (uri.scheme !== "file") {
      return;
    }

    return toSvnUri(uri, "");
  }

  show(filePath: string, revision?: string): Promise<string> {
    return this.repository.show(filePath, revision, {
      cwd: this.workspaceRoot
    });
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
    this._onDidChangeBranch.fire();
    const response = await this.repository.branch(name);
    this.isSwitchingBranch = false;
    this.updateBranches();
    this._onDidChangeBranch.fire();
    return response;
  }

  async switchBranch(name: string) {
    this.isSwitchingBranch = true;
    this._onDidChangeBranch.fire();

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
      this._onDidChangeBranch.fire();
    }
  }
}
