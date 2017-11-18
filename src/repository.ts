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
  Event
} from "vscode";
import { Resource } from "./resource";
import { throttleAsync } from "./decorators";
import { Repository as BaseRepository } from "./svn";
import { SvnStatusBar } from "./statusBar";
import { dispose } from "./util";

export class Repository {
  public watcher: FileSystemWatcher;
  public sourceControl: SourceControl;
  public changes: SourceControlResourceGroup;
  public notTracked: SourceControlResourceGroup;
  private disposables: Disposable[] = [];
  public branch = "";
  public branches: any[];

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
    this.watcher = workspace.createFileSystemWatcher("**");
    this.disposables.push(this.watcher);

    this.sourceControl = scm.createSourceControl(
      "svn",
      "SVN",
      Uri.file(repository.root)
    );
    this.sourceControl.acceptInputCommand = {
      command: "svn.commit",
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
    this.sourceControl.statusBarCommands = statusBar.commands;

    this.changes = this.sourceControl.createResourceGroup("changes", "Changes");
    this.notTracked = this.sourceControl.createResourceGroup(
      "unversioned",
      "Not Tracked"
    );

    this.changes.hideWhenEmpty = true;
    this.notTracked.hideWhenEmpty = true;

    this.update();
    this.addEventListeners();
  }

  private addEventListeners() {
    // this.watcher.onDidChange(throttleAsync(this.update, "update", this));
    // this.watcher.onDidCreate(throttleAsync(this.update, "update", this));
    // this.watcher.onDidDelete(throttleAsync(this.update, "update", this));
    this.watcher.onDidChange(() => {
      this.update();
    });
    this.watcher.onDidCreate(() => {
      this.update();
    });
    this.watcher.onDidDelete(() => {
      this.update();
    });
  }

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

    this.branch = await this.getCurrentBranch();

    this.branches = await this.repository.getBranches();

    this._onDidChangeStatus.fire();

    return Promise.resolve();
  }

  provideOriginalResource(uri: Uri): Uri | undefined {
    if (uri.scheme !== "file") {
      return;
    }

    return uri.with({ scheme: "svn", query: uri.path, path: uri.path });
  }

  show(filePath: string): Promise<string> {
    const config = workspace.getConfiguration("files", Uri.file(filePath));
    const encoding = config.get<string>("encoding");

    return this.repository.show(filePath, { encoding });
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
}
