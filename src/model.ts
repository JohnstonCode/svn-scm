import {
  workspace,
  Uri,
  window,
  Disposable,
  WorkspaceFoldersChangeEvent,
  EventEmitter,
  Event
} from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as micromatch from "micromatch";
import { Repository } from "./repository";
import { Svn } from "./svn";
import { dispose, anyEvent, filterEvent } from "./util";
import { sequentialize } from "./decorators";

export interface ModelChangeEvent {
  repository: Repository;
  uri: Uri;
}

export interface OriginalResourceChangeEvent {
  repository: Repository;
  uri: Uri;
}

interface OpenRepository extends Disposable {
  repository: Repository;
}

export class Model {
  private _onDidOpenRepository = new EventEmitter<Repository>();
  readonly onDidOpenRepository: Event<Repository> = this._onDidOpenRepository
    .event;

  private _onDidCloseRepository = new EventEmitter<Repository>();
  readonly onDidCloseRepository: Event<Repository> = this._onDidCloseRepository
    .event;

  private _onDidChangeRepository = new EventEmitter<ModelChangeEvent>();
  readonly onDidChangeRepository: Event<ModelChangeEvent> = this
    ._onDidChangeRepository.event;

  public openRepositories: OpenRepository[] = [];
  private disposables: Disposable[] = [];
  private enabled = false;
  private possibleSvnRepositoryPaths = new Set<string>();
  private ignoreList: string[];
  private maxDepth: number = 0;

  private configurationChangeDisposable: Disposable;

  get repositories(): Repository[] {
    return this.openRepositories.map(r => r.repository);
  }

  constructor(private svn: Svn) {
    const config = workspace.getConfiguration("svn");
    this.enabled = config.get("enabled") === true;

    this.configurationChangeDisposable = workspace.onDidChangeConfiguration(
      this.onDidChangeConfiguration,
      this
    );

    if (this.enabled) {
      this.enable();
    }
  }

  private onDidChangeConfiguration(): void {
    const config = workspace.getConfiguration("svn");
    const enabled = config.get("enabled") === true;

    this.maxDepth = config.get<number>("multipleFolders.depth", 0);

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

  private enable(): void {
    const config = workspace.getConfiguration("svn");

    const multipleFolders = config.get<boolean>(
      "multipleFolders.enabled",
      false
    );

    if (multipleFolders) {
      this.maxDepth = config.get<number>("multipleFolders.depth", 0);

      this.ignoreList = config.get("multipleFolders.ignore", []);
    }

    workspace.onDidChangeWorkspaceFolders(
      this.onDidChangeWorkspaceFolders,
      this,
      this.disposables
    );
    this.onDidChangeWorkspaceFolders({
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

    this.scanWorkspaceFolders();
  }

  private onPossibleSvnRepositoryChange(uri: Uri): void {
    const possibleSvnRepositoryPath = uri.fsPath.replace(/\.svn.*$/, "");
    this.possibleSvnRepositoryPaths.add(possibleSvnRepositoryPath);
    this.eventuallyScanPossibleSvnRepositories();
  }

  private eventuallyScanPossibleSvnRepositories(): void {
    for (const path of this.possibleSvnRepositoryPaths) {
      this.tryOpenRepository(path);
    }

    this.possibleSvnRepositoryPaths.clear();
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
      ) as OpenRepository[];

    possibleRepositoryFolders.forEach(p =>
      this.tryOpenRepository(p.uri.fsPath)
    );
    openRepositoriesToDispose.forEach(r => r.repository.dispose());
  }

  private async scanWorkspaceFolders() {
    for (const folder of workspace.workspaceFolders || []) {
      const root = folder.uri.fsPath;
      this.tryOpenRepository(root);
    }
  }

  @sequentialize
  async tryOpenRepository(path: string, level = 0): Promise<void> {
    if (this.getRepository(path)) {
      return;
    }

    let isSvnFolder = fs.existsSync(path + "/.svn");

    // If open only a subpath.
    if (!isSvnFolder && level === 0) {
      let pathParts = path.split(/[\\/]/);
      while (pathParts.length > 0) {
        pathParts.pop();
        let topPath = pathParts.join("/") + "/.svn";
        isSvnFolder = fs.existsSync(topPath);
        if (isSvnFolder) {
          break;
        }
      }
    }

    if (isSvnFolder) {
      try {
        const repositoryRoot = await this.svn.getRepositoryRoot(path);

        const repository = new Repository(this.svn.open(repositoryRoot, path));

        this.open(repository);
      } catch (err) {}
      return;
    }

    const newLevel = level + 1;
    if (newLevel <= this.maxDepth) {
      fs.readdirSync(path).forEach(file => {
        const dir = path + "/" + file;

        if (
          fs.statSync(dir).isDirectory() &&
          !micromatch.some([dir], this.ignoreList)
        ) {
          this.tryOpenRepository(dir, newLevel);
        }
      });
    }

    return;
  }

  getRepository(hint: any) {
    const liveRepository = this.getOpenRepository(hint);
    return liveRepository && liveRepository.repository;
  }

  getOpenRepository(hint: any): OpenRepository | undefined {
    if (!hint) {
      return undefined;
    }

    if (hint instanceof Repository) {
      return this.openRepositories.filter(r => r.repository === hint)[0];
    }

    if (typeof hint === "string") {
      hint = Uri.file(hint);
    }

    if (hint instanceof Uri) {
      for (const liveRepository of this.openRepositories) {
        const relativePath = path.relative(
          liveRepository.repository.workspaceRoot,
          hint.fsPath
        );

        if (!/^\.\./.test(relativePath)) {
          return liveRepository;
        }
      }

      return undefined;
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

  private open(repository: Repository): void {
    const changeListener = repository.onDidChangeRepository(uri =>
      this._onDidChangeRepository.fire({ repository, uri })
    );

    const dispose = () => {
      changeListener.dispose();
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

  async pickRepository() {
    if (this.openRepositories.length === 0) {
      throw new Error("There are no available repositories");
    }

    const picks: any[] = this.repositories.map(repository => {
      return {
        label: path.basename(repository.root),
        repository: repository
      };
    });
    const placeHolder = "Choose a repository";
    const pick = await window.showQuickPick(picks, { placeHolder });

    return pick && pick.repository;
  }

  dispose(): void {
    this.disable();
    this.configurationChangeDisposable.dispose();
  }
}
