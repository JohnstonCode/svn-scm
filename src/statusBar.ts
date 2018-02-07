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
    repository.onDidChangeStatus(
      this._onDidChange.fire,
      this._onDidChange,
      this.disposables
    );

    repository.onDidChangeOperations(
      this._onDidChange.fire,
      this._onDidChange,
      this.disposables
    );
  }

  get commands(): Command[] {
    const result: Command[] = [];

    if (this.repository.currentBranch) {
      result.push({
        command: "svn.switchBranch",
        tooltip: "switch branch",
        title: `$(git-branch) ${this.repository.currentBranch}`,
        arguments: [this.repository]
      });
    }

    const isIdle = this.repository.operations.isIdle();

    const icon = isIdle ? "sync" : "sync~spin";
    const title = !isIdle
      ? "Running"
      : this.repository.newsCommit > 0
        ? `${this.repository.newCommit} new commits`
        : "Updated";

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
