import {
  DecorationData,
  DecorationProvider,
  Disposable,
  Event,
  EventEmitter,
  Uri,
  window
} from "vscode";
import { ISvnResourceGroup } from "../common/types";
import { Repository } from "../repository";

export default class SvnDecorationProvider implements DecorationProvider {
  private readonly _onDidChangeDecorations = new EventEmitter<Uri[]>();
  public readonly onDidChangeDecorations: Event<Uri[]> = this
    ._onDidChangeDecorations.event;

  private disposables: Disposable[] = [];
  private decorations = new Map<string, DecorationData>();

  constructor(private repository: Repository) {
    this.disposables.push(
      window.registerDecorationProvider(this),
      repository.onDidRunOperation(this.onDidRunOperation, this)
    );
  }

  private onDidRunOperation(): void {
    const newDecorations = new Map<string, DecorationData>();
    this.collectDecorationData(this.repository.changes, newDecorations);
    this.collectDecorationData(this.repository.unversioned, newDecorations);
    this.collectDecorationData(this.repository.conflicts, newDecorations);

    this.repository.changelists.forEach((group, _changelist) => {
      this.collectDecorationData(group, newDecorations);
    });

    const uris: Uri[] = [];
    newDecorations.forEach((_value, uriString) => {
      if (this.decorations.has(uriString)) {
        this.decorations.delete(uriString);
      } else {
        uris.push(Uri.parse(uriString));
      }
    });
    this.decorations.forEach((_value, uriString) => {
      uris.push(Uri.parse(uriString));
    });
    this.decorations = newDecorations;
    this._onDidChangeDecorations.fire(uris);
  }

  private collectDecorationData(
    group: ISvnResourceGroup,
    bucket: Map<string, DecorationData>
  ): void {
    group.resourceStates.forEach(r => {
      if (r.resourceDecoration) {
        bucket.set(r.resourceUri.toString(), r.resourceDecoration);
      }
    });
  }

  public provideDecoration(uri: Uri): DecorationData | undefined {
    return this.decorations.get(uri.toString());
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
