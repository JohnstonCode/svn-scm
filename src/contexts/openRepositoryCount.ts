import { Disposable } from "vscode";
import { debounce } from "../decorators";
import { SourceControlManager } from "../source_control_manager";
import { IDisposable, setVscodeContext } from "../util";

export class OpenRepositoryCount implements IDisposable {
  private disposables: Disposable[] = [];

  constructor(private sourceControlManager: SourceControlManager) {
    // When repository Opened or closed
    sourceControlManager.onDidOpenRepository(
      this.checkOpened,
      this,
      this.disposables
    );
    sourceControlManager.onDidCloseRepository(
      this.checkOpened,
      this,
      this.disposables
    );

    this.checkOpened();
  }

  @debounce(100)
  private checkOpened() {
    setVscodeContext(
      "svnOpenRepositoryCount",
      this.sourceControlManager.repositories.length
    );
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
