import { Command, Disposable, Event, EventEmitter } from "vscode";
import { Repository } from "../repository";
import { anyEvent } from "../util";
import { CheckoutStatusBar } from "./checkoutStatusBar";
import { SyncStatusBar } from "./syncStatusBar";

export class StatusBarCommands {
  private checkoutStatusBar: CheckoutStatusBar;
  private syncStatusBar: SyncStatusBar;

  private disposables: Disposable[] = [];

  constructor(private repository: Repository) {
    this.checkoutStatusBar = new CheckoutStatusBar(repository);
    this.syncStatusBar = new SyncStatusBar(repository);

    this.disposables.push(this.checkoutStatusBar, this.syncStatusBar);
  }

  get onDidChange(): Event<void> {
    return anyEvent(
      this.syncStatusBar.onDidChange,
      this.checkoutStatusBar.onDidChange
    );
  }

  get commands(): Command[] {
    const result: Command[] = [];

    const checkout = this.checkoutStatusBar.command;

    if (checkout) {
      result.push(checkout);
    }

    const sync = this.syncStatusBar.command;

    if (sync) {
      result.push(sync);
    }

    return result;
  }

  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
  }
}
