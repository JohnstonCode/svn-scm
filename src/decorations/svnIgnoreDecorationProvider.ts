import * as path from "path";
import {
  DecorationData,
  DecorationProvider,
  Disposable,
  Event,
  EventEmitter,
  ThemeColor,
  Uri,
  window
} from "vscode";
import { debounce } from "../decorators";
import { Repository } from "../repository";
import { isDescendant } from "../util";

export default class SvnIgnoreDecorationProvider implements DecorationProvider {
  private readonly _onDidChangeDecorations = new EventEmitter<Uri[]>();
  public readonly onDidChangeDecorations: Event<Uri[]> = this
    ._onDidChangeDecorations.event;

  private checkIgnoreQueue = new Map<
    string,
    { resolve: (status: boolean) => void; reject: (err: any) => void }
  >();
  private disposables: Disposable[] = [];

  constructor(private repository: Repository) {
    this.disposables.push(
      window.registerDecorationProvider(this),
      repository.onDidChangeStatus(_ => this._onDidChangeDecorations.fire())
    );
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.checkIgnoreQueue.clear();
  }

  public provideDecoration(uri: Uri): Promise<DecorationData | undefined> {
    return new Promise<boolean>((resolve, reject) => {
      this.checkIgnoreQueue.set(uri.fsPath, { resolve, reject });
      this.checkIgnoreSoon();
    }).then(ignored => {
      if (ignored) {
        return {
          priority: 3,
          color: new ThemeColor("gitDecoration.ignoredResourceForeground")
        } as DecorationData;
      }
    });
  }

  @debounce(500)
  private checkIgnoreSoon(): void {
    const queue = new Map(this.checkIgnoreQueue.entries());
    this.checkIgnoreQueue.clear();

    const ignored = this.repository.statusIgnored;
    const external = this.repository.statusExternal;

    const files = ignored.map(stat =>
      path.join(this.repository.workspaceRoot, stat.path)
    );

    files.push(
      ...external.map(stat =>
        path.join(this.repository.workspaceRoot, stat.path)
      )
    );

    for (const [key, value] of queue.entries()) {
      value.resolve(files.some(file => isDescendant(file, key)));
    }
  }
}
