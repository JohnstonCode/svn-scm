import { Event, EventEmitter, Uri, workspace } from "vscode";
import { anyEvent, filterEvent, IDisposable, isDescendant } from "../util";

export class RepositoryFilesWatcher implements IDisposable {
  private disposables: IDisposable[] = [];

  public onDidChange: Event<Uri>;
  public onDidCreate: Event<Uri>;
  public onDidDelete: Event<Uri>;
  public onDidAny: Event<Uri>;

  public onDidWorkspaceChange: Event<Uri>;
  public onDidWorkspaceCreate: Event<Uri>;
  public onDidWorkspaceDelete: Event<Uri>;
  public onDidWorkspaceAny: Event<Uri>;

  public onDidSvnChange: Event<Uri>;
  public onDidSvnCreate: Event<Uri>;
  public onDidSvnDelete: Event<Uri>;
  public onDidSvnAny: Event<Uri>;

  constructor(readonly root: string) {
    const fsWatcher = workspace.createFileSystemWatcher("**");
    this.disposables.push(fsWatcher);

    const ignoreTmp = (uri: Uri) => !/[\\\/]\.svn[\\\/]tmp/.test(uri.path);

    const ignoreNonRelevants = (uri: Uri) =>
      ignoreTmp(uri) && !isDescendant(this.root, uri.fsPath);

    this.onDidChange = filterEvent(fsWatcher.onDidChange, ignoreNonRelevants);
    this.onDidCreate = filterEvent(fsWatcher.onDidCreate, ignoreNonRelevants);
    this.onDidDelete = filterEvent(fsWatcher.onDidDelete, ignoreNonRelevants);

    this.onDidAny = anyEvent(
      this.onDidChange,
      this.onDidCreate,
      this.onDidDelete
    );

    const svnPattern = /[\\\/]\.svn[\\\/]/;

    const ignoreSvn = (uri: Uri) => !svnPattern.test(uri.path);

    this.onDidWorkspaceChange = filterEvent(this.onDidChange, ignoreSvn);
    this.onDidWorkspaceCreate = filterEvent(this.onDidCreate, ignoreSvn);
    this.onDidWorkspaceDelete = filterEvent(this.onDidDelete, ignoreSvn);

    this.onDidWorkspaceAny = anyEvent(
      this.onDidWorkspaceChange,
      this.onDidWorkspaceCreate,
      this.onDidWorkspaceDelete
    );
    const ignoreWorkspace = (uri: Uri) => svnPattern.test(uri.path);

    this.onDidSvnChange = filterEvent(this.onDidChange, ignoreWorkspace);
    this.onDidSvnCreate = filterEvent(this.onDidCreate, ignoreWorkspace);
    this.onDidSvnDelete = filterEvent(this.onDidDelete, ignoreWorkspace);

    this.onDidSvnAny = anyEvent(
      this.onDidSvnChange,
      this.onDidSvnCreate,
      this.onDidSvnDelete
    );
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
