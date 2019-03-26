import { commands, Disposable } from "vscode";
import { debounce } from "../decorators";
import { Model } from "../model";
import { IDisposable } from "../util";

export class OpenRepositoryCount implements IDisposable {
  private disposables: Disposable[] = [];

  constructor(private model: Model) {
    // When repository Opened or closed
    model.onDidOpenRepository(this.checkOpened, this, this.disposables);
    model.onDidCloseRepository(this.checkOpened, this, this.disposables);

    this.checkOpened();
  }

  @debounce(100)
  private checkOpened() {
    commands.executeCommand(
      "setContext",
      "svnOpenRepositoryCount",
      `${this.model.repositories.length}`
    );
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
