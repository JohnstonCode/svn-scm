import {
  Uri,
  scm,
  workspace,
  FileSystemWatcher,
  SourceControl,
  SourceControlResourceGroup,
  SourceControlInputBox
} from "vscode";
import { Resource } from "./resource";
import { throttleAsync } from "./decorators";
import { Repository as BaseRepository } from "./svn";

export class Repository {
  public watcher: FileSystemWatcher;
  private sourceControl: SourceControl;
  public changes: SourceControlResourceGroup;
  public notTracked: SourceControlResourceGroup;

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

    return Promise.resolve();
  }

  provideOriginalResource(uri: Uri) {
    if (uri.scheme !== "file") {
      return;
    }

    return new Uri().with({ scheme: "svn", query: uri.path, path: uri.path });
  }

  show(filePath: string) {
    const config = workspace.getConfiguration("files", Uri.file(filePath));
    const encoding = config.get("encoding");

    return this.repository.show(filePath, { encoding });
  }
}
