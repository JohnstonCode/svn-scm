import * as fs from "fs";
import { Minimatch } from "minimatch";
import * as path from "path";
import {
  commands,
  Disposable,
  Event,
  EventEmitter,
  SourceControlResourceGroup,
  Uri,
  window,
  workspace,
  WorkspaceFoldersChangeEvent
} from "vscode";
import {
  ConstructorPolicy,
  IModelChangeEvent,
  IOpenRepository,
  RepositoryState,
  Status
} from "./common/types";
import { debounce, sequentialize } from "./decorators";
import { configuration } from "./helpers/configuration";
import { RemoteRepository } from "./remoteRepository";
import { Repository } from "./repository";
import { Svn, svnErrorCodes } from "./svn";
import SvnError from "./svnError";
import {
  anyEvent,
  dispose,
  filterEvent,
  IDisposable,
  isDescendant,
  normalizePath
} from "./util";

export class Model implements IDisposable {
  private _onDidOpenRepository = new EventEmitter<Repository>();
  public readonly onDidOpenRepository: Event<Repository> = this
    ._onDidOpenRepository.event;

  private _onDidCloseRepository = new EventEmitter<Repository>();
  public readonly onDidCloseRepository: Event<Repository> = this
    ._onDidCloseRepository.event;

  private _onDidChangeRepository = new EventEmitter<IModelChangeEvent>();
  public readonly onDidChangeRepository: Event<IModelChangeEvent> = this
    ._onDidChangeRepository.event;

  public openRepositories: IOpenRepository[] = [];
  private disposables: Disposable[] = [];
  private enabled = false;
  private possibleSvnRepositoryPaths = new Set<string>();
  private ignoreList: string[] = [];
  private maxDepth: number = 0;

  private configurationChangeDisposable: Disposable;

  get repositories(): Repository[] {
    return this.openRepositories.map(r => r.repository);
  }

  get svn(): Svn {
    return this._svn;
  }

  constructor(private _svn: Svn, policy: ConstructorPolicy) {
    if (policy !== ConstructorPolicy.Async) {
      throw new Error("Unsopported policy");
    }
    this.enabled = configuration.get<boolean>("enabled") === true;

    this.configurationChangeDisposable = workspace.onDidChangeConfiguration(
      this.onDidChangeConfiguration,
      this
    );

    return ((async (): Promise<Model> => {
      if (this.enabled) {
        await this.enable();
      }
      return this;
    })() as unknown) as Model;
  }

  private onDidChangeConfiguration(): void {
    const enabled = configuration.get<boolean>("enabled") === true;

    this.maxDepth = configuration.get<number>("multipleFolders.depth", 0);

    if (enabled === this.enabled) {
      return;
    }

    this.enabled = enabled;

    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }

  private async enable() {
    const multipleFolders = configuration.get<boolean>(
      "multipleFolders.enabled",
      false
    );

    if (multipleFolders) {
      this.maxDepth = configuration.get<number>("multipleFolders.depth", 0);

      this.ignoreList = configuration.get("multipleFolders.ignore", []);
    }

    workspace.onDidChangeWorkspaceFolders(
      this.onDidChangeWorkspaceFolders,
      this,
      this.disposables
    );
    await this.onDidChangeWorkspaceFolders({
      added: workspace.workspaceFolders || [],
      removed: []
    });

    const fsWatcher = workspace.createFileSystemWatcher("**");
    this.disposables.push(fsWatcher);

    const onWorkspaceChange = anyEvent(
      fsWatcher.onDidChange,
      fsWatcher.onDidCreate,
      fsWatcher.onDidDelete
    );
    const onPossibleSvnRepositoryChange = filterEvent(
      onWorkspaceChange,
      uri => !this.getRepository(uri)
    );
    onPossibleSvnRepositoryChange(
      this.onPossibleSvnRepositoryChange,
      this,
      this.disposables
    );

    window.onDidChangeActiveTextEditor(
      () => this.checkHasChangesOnActiveEditor(),
      this,
      this.disposables
    );

    await this.scanWorkspaceFolders();
  }

  private onPossibleSvnRepositoryChange(uri: Uri): void {
    const possibleSvnRepositoryPath = uri.fsPath.replace(/\.svn.*$/, "");
    this.eventuallyScanPossibleSvnRepository(possibleSvnRepositoryPath);
  }

  private eventuallyScanPossibleSvnRepository(path: string) {
    this.possibleSvnRepositoryPaths.add(path);
    this.eventuallyScanPossibleSvnRepositories();
  }

  @debounce(500)
  private eventuallyScanPossibleSvnRepositories(): void {
    for (const path of this.possibleSvnRepositoryPaths) {
      this.tryOpenRepository(path);
    }

    this.possibleSvnRepositoryPaths.clear();
  }

  private scanExternals(repository: Repository): void {
    const shouldScanExternals =
      configuration.get<boolean>("detectExternals") === true;

    if (!shouldScanExternals) {
      return;
    }

    repository.statusExternal
      .map(r => path.join(repository.workspaceRoot, r.path))
      .forEach(p => this.eventuallyScanPossibleSvnRepository(p));
  }

  private hasChangesOnActiveEditor(): boolean {
    if (!window.activeTextEditor) {
      return false;
    }
    const uri = window.activeTextEditor.document.uri;

    const repository = this.getRepository(uri);
    if (!repository) {
      return false;
    }

    const resource = repository.getResourceFromFile(uri);
    if (!resource) {
      return false;
    }

    switch (resource.type) {
      case Status.ADDED:
      case Status.DELETED:
      case Status.EXTERNAL:
      case Status.IGNORED:
      case Status.NONE:
      case Status.NORMAL:
      case Status.UNVERSIONED:
        return false;
      case Status.CONFLICTED:
      case Status.INCOMPLETE:
      case Status.MERGED:
      case Status.MISSING:
      case Status.MODIFIED:
      case Status.OBSTRUCTED:
      case Status.REPLACED:
        return true;
    }

    // Show if not match
    return true;
  }

  @debounce(100)
  private checkHasChangesOnActiveEditor() {
    commands.executeCommand(
      "setContext",
      "svnActiveEditorHasChanges",
      this.hasChangesOnActiveEditor()
    );
  }

  private disable(): void {
    this.repositories.forEach(repository => repository.dispose());
    this.openRepositories = [];

    this.possibleSvnRepositoryPaths.clear();
    this.disposables = dispose(this.disposables);
  }

  private async onDidChangeWorkspaceFolders({
    added,
    removed
  }: WorkspaceFoldersChangeEvent) {
    const possibleRepositoryFolders = added.filter(
      folder => !this.getOpenRepository(folder.uri)
    );

    const openRepositoriesToDispose = removed
      .map(folder => this.getOpenRepository(folder.uri.fsPath))
      .filter(repository => !!repository)
      .filter(
        repository =>
          !(workspace.workspaceFolders || []).some(f =>
            repository!.repository.workspaceRoot.startsWith(f.uri.fsPath)
          )
      ) as IOpenRepository[];

    possibleRepositoryFolders.forEach(p =>
      this.tryOpenRepository(p.uri.fsPath)
    );
    openRepositoriesToDispose.forEach(r => r.repository.dispose());
  }

  private async scanWorkspaceFolders() {
    for (const folder of workspace.workspaceFolders || []) {
      const root = folder.uri.fsPath;
      await this.tryOpenRepository(root);
    }
  }

  @sequentialize
  public async tryOpenRepository(path: string, level = 0): Promise<void> {
    if (this.getRepository(path)) {
      return;
    }

    let isSvnFolder = fs.existsSync(path + "/.svn");

    // If open only a subpath.
    if (!isSvnFolder && level === 0) {
      const pathParts = path.split(/[\\/]/);
      while (pathParts.length > 0) {
        pathParts.pop();
        const topPath = pathParts.join("/") + "/.svn";
        isSvnFolder = fs.existsSync(topPath);
        if (isSvnFolder) {
          break;
        }
      }
    }

    if (isSvnFolder) {
      // Config based on folder path
      const resourceConfig = workspace.getConfiguration("svn", Uri.file(path));

      const ignoredRepos = new Set(
        (resourceConfig.get<string[]>("ignoreRepositories") || []).map(p =>
          normalizePath(p)
        )
      );

      if (ignoredRepos.has(normalizePath(path))) {
        return;
      }

      try {
        const repositoryRoot = await this.svn.getRepositoryRoot(path);

        const repository = new Repository(
          await this.svn.open(repositoryRoot, path)
        );

        this.open(repository);
      } catch (err) {
        if (err instanceof SvnError) {
          if (err.svnErrorCode === svnErrorCodes.WorkingCopyIsTooOld) {
            await commands.executeCommand("svn.upgrade", path);
            return;
          }
        }
        console.error(err);
      }
      return;
    }

    const mm = new Minimatch("*");
    const newLevel = level + 1;
    if (newLevel <= this.maxDepth) {
      for (const file of fs.readdirSync(path)) {
        const dir = path + "/" + file;

        if (
          fs.statSync(dir).isDirectory() &&
          !mm.matchOne([dir], this.ignoreList, false)
        ) {
          await this.tryOpenRepository(dir, newLevel);
        }
      }
    }
  }

  public async getRemoteRepository(uri: Uri): Promise<RemoteRepository> {
    return RemoteRepository.open(this.svn, uri);
  }

  public getRepository(hint: any) {
    const liveRepository = this.getOpenRepository(hint);
    if (liveRepository && liveRepository.repository) {
      return liveRepository.repository;
    }
  }

  public getOpenRepository(hint: any): IOpenRepository | undefined {
    if (!hint) {
      return undefined;
    }

    if (hint instanceof Repository) {
      return this.openRepositories.find(r => r.repository === hint);
    }

    if ((hint as any).repository instanceof Repository) {
      return this.openRepositories.find(
        r => r.repository === (hint as any).repository
      );
    }

    if (typeof hint === "string") {
      hint = Uri.file(hint);
    }

    if (hint instanceof Uri) {
      return this.openRepositories.find(liveRepository => {
        if (
          !isDescendant(liveRepository.repository.workspaceRoot, hint.fsPath)
        ) {
          return false;
        }

        for (const external of liveRepository.repository.statusExternal) {
          const externalPath = path.join(
            liveRepository.repository.workspaceRoot,
            external.path
          );
          if (isDescendant(externalPath, hint.fsPath)) {
            return false;
          }
        }

        return true;
      });
    }

    for (const liveRepository of this.openRepositories) {
      const repository = liveRepository.repository;

      if (hint === repository.sourceControl) {
        return liveRepository;
      }

      if (hint === repository.changes) {
        return liveRepository;
      }
    }

    return undefined;
  }

  public async getRepositoryFromUri(uri: Uri) {
    for (const liveRepository of this.openRepositories) {
      const repository = liveRepository.repository;

      try {
        const path = normalizePath(uri.fsPath);
        const info = await repository.info(path);

        return repository;
      } catch (error) {
        console.error();
      }
    }
  }

  private open(repository: Repository): void {
    const onDidDisappearRepository = filterEvent(
      repository.onDidChangeState,
      state => state === RepositoryState.Disposed
    );
    const disappearListener = onDidDisappearRepository(() => dispose());

    const changeListener = repository.onDidChangeRepository(uri =>
      this._onDidChangeRepository.fire({ repository, uri })
    );

    const statusListener = repository.onDidChangeStatus(() => {
      this.scanExternals(repository);
      this.checkHasChangesOnActiveEditor();
    });
    this.scanExternals(repository);

    const dispose = () => {
      disappearListener.dispose();
      changeListener.dispose();
      statusListener.dispose();
      repository.dispose();

      this.openRepositories = this.openRepositories.filter(
        e => e !== openRepository
      );
      this._onDidCloseRepository.fire(repository);
    };

    const openRepository = { repository, dispose };
    this.openRepositories.push(openRepository);
    this._onDidOpenRepository.fire(repository);
  }

  public close(repository: Repository): void {
    const openRepository = this.getOpenRepository(repository);

    if (!openRepository) {
      return;
    }

    openRepository.dispose();
  }

  public async pickRepository() {
    if (this.openRepositories.length === 0) {
      throw new Error("There are no available repositories");
    }

    const picks: any[] = this.repositories.map(repository => {
      return {
        label: path.basename(repository.root),
        repository
      };
    });
    const placeHolder = "Choose a repository";
    const pick = await window.showQuickPick(picks, { placeHolder });

    return pick && pick.repository;
  }

  public async upgradeWorkingCopy(folderPath: string): Promise<boolean> {
    try {
      const result = await this.svn.exec(folderPath, ["upgrade"]);
      return result.exitCode === 0;
    } catch (e) {
      console.log(e);
    }
    return false;
  }

  public dispose(): void {
    this.disable();
    this.configurationChangeDisposable.dispose();
  }
}
