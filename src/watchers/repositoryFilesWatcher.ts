import { Event, Uri, workspace, EventEmitter } from "vscode";
import { watch } from "fs";
import { exists } from "../fs";
import { join } from "path";
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
    const _onRepoChange = new EventEmitter<Uri>();
    const _onRepoCreate = new EventEmitter<Uri>();
    const _onRepoDelete = new EventEmitter<Uri>();
    let onRepoChange: Event<Uri> | undefined;
    let onRepoCreate: Event<Uri> | undefined;
    let onRepoDelete: Event<Uri> | undefined;

    if (
      typeof workspace.workspaceFolders !== "undefined" &&
      !workspace.workspaceFolders.filter(w => isDescendant(w.uri.fsPath, root))
        .length
    ) {
      const repoWatcher = watch(join(root, ".svn"), (event, filename) => {
        if (event === "change") {
          _onRepoChange.fire(Uri.parse(filename));
        } else if (event === "rename") {
          exists(filename).then(doesExist => {
            if (doesExist) {
              _onRepoCreate.fire(Uri.parse(filename));
            } else {
              _onRepoDelete.fire(Uri.parse(filename));
            }
          });
        }
      });

      repoWatcher.on("error", error => {
        throw error;
      });

      onRepoChange = _onRepoChange.event;
      onRepoCreate = _onRepoCreate.event;
      onRepoDelete = _onRepoDelete.event;
    }

    this.disposables.push(fsWatcher);

    const isTmp = (uri: Uri) => /[\\\/]\.svn[\\\/]tmp/.test(uri.path);

    const isRelevant = (uri: Uri) =>
      !isTmp(uri) && isDescendant(this.root, uri.fsPath);

    this.onDidChange = filterEvent(fsWatcher.onDidChange, isRelevant);
    this.onDidCreate = filterEvent(fsWatcher.onDidCreate, isRelevant);
    this.onDidDelete = filterEvent(fsWatcher.onDidDelete, isRelevant);

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

    if (onRepoChange && onRepoCreate && onRepoDelete) {
      this.onDidSvnChange = onRepoChange;
      this.onDidSvnCreate = onRepoCreate;
      this.onDidSvnDelete = onRepoDelete;
    }

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
