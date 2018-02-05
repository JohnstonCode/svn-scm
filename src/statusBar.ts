import {
  window,
  StatusBarItem,
  Disposable,
  EventEmitter,
  Event,
  Command
} from "vscode";
import { Repository } from "./repository";

export class SvnStatusBar {
  private disposables: Disposable[] = [];
  private _onDidChange = new EventEmitter<void>();

  get onDidChange(): Event<void> {
    return this._onDidChange.event;
  }

  constructor(private repository: Repository) {
    repository.onDidChangeBranch(
      this._onDidChange.fire,
      this._onDidChange,
      this.disposables
    );
    repository.onDidChangeRepository(
      () => {
        if (!this.repository.isSwitchingBranch) {
          this._onDidChange.fire();
        }
      },
      null,
      this.disposables
    );
    repository.onDidChangeNewCommits(
      this._onDidChange.fire,
      this._onDidChange,
      this.disposables
    );
  }

  get commands(): Command[] {
    const result: Command[] = [];

    if (this.repository.currentBranch) {
      const icon = this.repository.isSwitchingBranch
        ? "sync~spin"
        : "git-branch";
      result.push({
        command: "svn.switchBranch",
        tooltip: "switch branch",
        title: `$(${icon}) ${this.repository.currentBranch}`,
        arguments: [this.repository]
      });
    }

    const icon = this.repository.isUpdatingRevision ? "sync~spin" : "sync";
    const title =
      this.repository.newCommits > 0
        ? `${this.repository.newCommits} new commits`
        : "No new commits";

    result.push({
      command: "svn.update",
      tooltip: "Update Revision",
      title: `$(${icon}) ${title}`,
      arguments: [this.repository]
    });
    return result;
  }

  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
  }
}
