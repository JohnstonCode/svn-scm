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

    let icon = "sync";
    let title = "Updated";
    let command = "svn.update";
    let tooltip = "Update Revision";

    if (!isIdle) {
      icon = "sync~spin";
      title = "Running";
      tooltip = "Running";
      command = "";
    } else if (this.repository.needCleanUp) {
      icon = "alert";
      title = "Need cleanup";
      tooltip = "Run cleanup command";
      command = "svn.cleanup";
    } else if (this.repository.isIncomplete) {
      icon = "issue-reopened";
      title = "Incomplete (Need finish checkout)";
      tooltip = "Run update to complete";
      command = "svn.finishCheckout";
    } else if (this.repository.newCommit > 0) {
      title = `${this.repository.newCommit} new commits`;
    }

    result.push({
      command: command,
      tooltip: tooltip,
      title: `$(${icon}) ${title}`,
      arguments: [this.repository]
    });
    return result;
  }

  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
  }
}
