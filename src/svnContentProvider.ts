import {
  Disposable,
  Event,
  EventEmitter,
  TextDocumentContentProvider,
  Uri,
  window,
  workspace
} from "vscode";
import {
  ICache,
  ICacheRow,
  RepositoryChangeEvent,
  SvnUriAction
} from "./common/types";
import { debounce, throttle } from "./decorators";
import { SourceControlManager } from "./source_control_manager";
import { fromSvnUri } from "./uri";
import {
  eventToPromise,
  filterEvent,
  IDisposable,
  isDescendant,
  toDisposable
} from "./util";

const THREE_MINUTES = 1000 * 60 * 3;
const FIVE_MINUTES = 1000 * 60 * 5;

export class SvnContentProvider
  implements IDisposable, TextDocumentContentProvider {
  private _onDidChange = new EventEmitter<Uri>();
  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  private changedRepositoryRoots = new Set<string>();
  private cache: ICache = Object.create(null);
  private disposables: Disposable[] = [];

  constructor(private sourceControlManager: SourceControlManager) {
    this.disposables.push(
      sourceControlManager.onDidChangeRepository(
        this.onDidChangeRepository,
        this
      ),
      workspace.registerTextDocumentContentProvider("svn", this)
    );

    const interval = setInterval(() => this.cleanup(), FIVE_MINUTES);
    this.disposables.push(toDisposable(() => clearInterval(interval)));
  }

  private onDidChangeRepository({ repository }: RepositoryChangeEvent): void {
    this.changedRepositoryRoots.add(repository.root);
    this.eventuallyFireChangeEvents();
  }

  @debounce(1100)
  private eventuallyFireChangeEvents(): void {
    this.fireChangeEvents();
  }

  @throttle
  private async fireChangeEvents(): Promise<void> {
    if (!window.state.focused) {
      const onDidFocusWindow = filterEvent(
        window.onDidChangeWindowState,
        e => e.focused
      );
      await eventToPromise(onDidFocusWindow);
    }

    // Don't check if no has repository changes
    if (this.changedRepositoryRoots.size === 0) {
      return;
    }

    // Use copy to allow new items in parallel
    const roots = Array.from(this.changedRepositoryRoots);
    this.changedRepositoryRoots.clear();

    const keys = Object.keys(this.cache);

    cacheLoop: for (const key of keys) {
      const uri = this.cache[key].uri;
      const fsPath = uri.fsPath;

      for (const root of roots) {
        if (isDescendant(root, fsPath)) {
          this._onDidChange.fire(uri);
          continue cacheLoop;
        }
      }
    }
  }

  public async provideTextDocumentContent(uri: Uri): Promise<string> {
    try {
      const { fsPath, action, extra } = fromSvnUri(uri);

      const repository = this.sourceControlManager.getRepository(fsPath);

      if (!repository) {
        return "";
      }

      const cacheKey = uri.toString();
      const timestamp = new Date().getTime();
      const cacheValue: ICacheRow = { uri, timestamp };

      this.cache[cacheKey] = cacheValue;

      if (action === SvnUriAction.SHOW) {
        const ref = extra.ref;
        return await repository.show(fsPath, ref);
      }
      if (action === SvnUriAction.LOG) {
        return await repository.plainLog();
      }
      if (action === SvnUriAction.LOG_REVISION && extra.revision) {
        return await repository.plainLogByRevision(extra.revision);
      }
      if (action === SvnUriAction.LOG_SEARCH && extra.search) {
        return await repository.plainLogByText(extra.search);
      }
      if (action === SvnUriAction.PATCH) {
        return await repository.patch([fsPath]);
      }
    } catch (error) {
      // Dont show error
    }
    return "";
  }

  private cleanup(): void {
    const now = new Date().getTime();
    const cache = Object.create(null);

    Object.keys(this.cache).forEach(key => {
      const row = this.cache[key];
      const { fsPath } = fromSvnUri(row.uri);
      const isOpen = workspace.textDocuments
        .filter(d => d.uri.scheme === "file")
        .some(d => d.uri.fsPath === fsPath);

      if (isOpen || now - row.timestamp < THREE_MINUTES) {
        cache[row.uri.toString()] = row;
      }
    });

    this.cache = cache;
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
