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
import { Resource, SvnResourceGroup } from "./resource";
import { throttle, debounce } from "./decorators";
import { Repository as BaseRepository } from "./svnRepository";
import { SvnStatusBar } from "./statusBar";
import { dispose, anyEvent, filterEvent, toDisposable } from "./util";
import * as path from "path";
import * as micromatch from "micromatch";
import { setInterval, clearInterval } from "timers";
import { toSvnUri } from "./uri";
import { Status, PropStatus } from "./svn";
import { IFileStatus } from "./statusParser";

export class Repository {
  public watcher: FileSystemWatcher;
  public sourceControl: SourceControl;
  public changes: SvnResourceGroup;
  public unversioned: SvnResourceGroup;
  public external: SvnResourceGroup;
  public changelists: Map<string, SvnResourceGroup> = new Map();
  public conflicts: SvnResourceGroup;
  public statusIgnored: IFileStatus[] = [];
  public statusExternal: IFileStatus[] = [];
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

    this.changes = this.sourceControl.createResourceGroup(
      "changes",
      "Changes"
    ) as SvnResourceGroup;
    this.unversioned = this.sourceControl.createResourceGroup(
      "unversioned",
      "Unversioned"
    ) as SvnResourceGroup;
    this.external = this.sourceControl.createResourceGroup(
      "external",
      "External"
    ) as SvnResourceGroup;
    this.conflicts = this.sourceControl.createResourceGroup(
      "conflicts",
      "conflicts"
    ) as SvnResourceGroup;

    this.changes.hideWhenEmpty = true;
    this.unversioned.hideWhenEmpty = true;
    this.external.hideWhenEmpty = true;
    this.conflicts.hideWhenEmpty = true;

    this.disposables.push(
      toDisposable(() => clearInterval(this.branchesTimer))
    );

    const svnConfig = workspace.getConfiguration("svn");
    const updateFreq = svnConfig.get<number>("branch.update");

    if (updateFreq) {
      setInterval(() => {
        this.updateBranches();
      }, 1000 * 60 * updateFreq);
    }

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
    let unversioned: any[] = [];
    let external: any[] = [];
    let conflicts: any[] = [];
    let changelists: Map<string, Resource[]> = new Map();

    this.statusExternal = [];
    this.statusIgnored = [];

    const statuses = (await this.repository.getStatus(true)) || [];

    const fileConfig = workspace.getConfiguration("files", Uri.file(this.root));
    const svnConfig = workspace.getConfiguration("svn");

    const filesToExclude = fileConfig.get<any>("exclude");

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

      const resource = new Resource(
        uri,
        status.status,
        renameUri,
        status.props
      );

      if (status.status === Status.NORMAL && status.props === PropStatus.NONE) {
        // On commit, `svn status` return all locked files with status="normal" and props="none"
        return;
      } else if (status.status === Status.IGNORED) {
        this.statusIgnored.push(status);
      } else if (status.status === Status.EXTERNAL) {
        this.statusExternal.push(status);
        external.push(resource);
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
          return;
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
    });

    this.changes.resourceStates = changes;
    this.unversioned.resourceStates = unversioned;
    this.conflicts.resourceStates = conflicts;

    this.changelists.forEach((group, changelist) => {
      group.resourceStates = [];
    });

    changelists.forEach((resources, changelist) => {
      let group = this.changelists.get(changelist);
      if (!group) {
        // Prefix 'changelist-' to prevent double id with 'change' or 'external'
        group = this.sourceControl.createResourceGroup(
          `changelist-${changelist}`,
          `Changelist "${changelist}"`
        ) as SvnResourceGroup;
        group.hideWhenEmpty = true;

        this.changelists.set(changelist, group);
      }

      group.resourceStates = resources;
    });

    if (svnConfig.get<boolean>("sourceControl.showExternal")) {
      this.external.resourceStates = external;
    } else {
      this.external.resourceStates = [];
    }

    this.currentBranch = await this.getCurrentBranch();

    this._onDidChangeStatus.fire();

    return Promise.resolve();
  }

  public getResourceFromFile(uri: string | Uri): Resource | undefined {
    if (typeof uri === "string") {
      uri = Uri.file(uri);
    }

    const groups = [
      this.changes,
      this.unversioned,
      this.external,
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

  addChangelist(filePath: string, changelist: string) {
    return this.repository.addChangelist(filePath, changelist);
  }

  removeChangelist(changelist: string) {
    return this.repository.removeChangelist(changelist);
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

  async resolve(file: string, action: string) {
    try {
      const response = await this.repository.resolve(file, action);
      window.showInformationMessage(response);
    } catch (error) {
      window.showErrorMessage(error);
    }
  }
}
