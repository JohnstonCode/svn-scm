import { Disposable, window } from "vscode";
import { Status } from "../common/types";
import { debounce } from "../decorators";
import { SourceControlManager } from "../source_control_manager";
import { IDisposable, setVscodeContext } from "../util";

export class CheckActiveEditor implements IDisposable {
  private disposables: Disposable[] = [];

  constructor(private sourceControlManager: SourceControlManager) {
    // When repository update, like update
    sourceControlManager.onDidChangeStatusRepository(
      this.checkHasChangesOnActiveEditor,
      this,
      this.disposables
    );

    window.onDidChangeActiveTextEditor(
      () => this.checkHasChangesOnActiveEditor(),
      this,
      this.disposables
    );
  }

  @debounce(100)
  private checkHasChangesOnActiveEditor() {
    setVscodeContext(
      "svnActiveEditorHasChanges",
      this.hasChangesOnActiveEditor()
    );
  }

  private hasChangesOnActiveEditor(): boolean {
    if (!window.activeTextEditor) {
      return false;
    }
    const uri = window.activeTextEditor.document.uri;

    const repository = this.sourceControlManager.getRepository(uri);
    if (!repository) {
      return false;
    }

    const resource = repository.getResourceFromFile(uri);
    if (!resource) {
      return false;
    }

    switch (resource.type) {
      case Status.ADDED:
      case Status.DELETED:
      case Status.EXTERNAL:
      case Status.IGNORED:
      case Status.NONE:
      case Status.NORMAL:
      case Status.UNVERSIONED:
        return false;
      case Status.CONFLICTED:
      case Status.INCOMPLETE:
      case Status.MERGED:
      case Status.MISSING:
      case Status.MODIFIED:
      case Status.OBSTRUCTED:
      case Status.REPLACED:
        return true;
    }

    // Show if not match
    return true;
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
