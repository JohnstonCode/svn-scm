import { Command, Disposable, Event, EventEmitter } from "vscode";
import { Operation } from "../common/types";
import { Repository } from "../repository";

export class CheckoutStatusBar {
  private _onDidChange = new EventEmitter<void>();
  get onDidChange(): Event<void> {
    return this._onDidChange.event;
  }
  private disposables: Disposable[] = [];

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

  get command(): Command | undefined {
    if (!this.repository.currentBranch) {
      return;
    }

    const isSwitchRunning =
      this.repository.operations.isRunning(Operation.SwitchBranch) ||
      this.repository.operations.isRunning(Operation.NewBranch);

    const title = `$(git-branch) ${this.repository.currentBranch}${
      isSwitchRunning ? ` (Switching)` : ""
    }`;

    return {
      command: "svn.switchBranch",
      tooltip: "Switch Branch...",
      title,
      arguments: [this.repository.sourceControl]
    };
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
