import { QuickPickItem } from "vscode";
import { Repository } from "../repository";
import { Resource } from "../resource";

export class FileItem implements QuickPickItem {
  constructor(
    protected _repository: Repository,
    protected _state: Resource,
    public picked = false
  ) { }

  get label(): string {
    return this._repository.repository.removeAbsolutePath(this._state.resourceUri.fsPath);
  }

  get description(): string {
    return this._state.resourceUri.fsPath;
  }
  get state(): Resource {
    return this._state;
  }
}
