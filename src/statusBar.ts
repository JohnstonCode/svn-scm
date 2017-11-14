import { window, StatusBarItem, Disposable, EventEmitter, Event } from "vscode";
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
  }

  get commands() {
    // const title = `$(git-branch) ${this.repository.headLabel}`;

    return [
      {
        command: "svn.refresh",
        tooltip: "TEST",
        title: "TEST",
        arguments: [this]
      }
    ];
  }

  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
  }
}
