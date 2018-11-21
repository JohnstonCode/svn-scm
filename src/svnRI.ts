import * as path from "path";
import { Uri } from "vscode";

export class SvnRI {
  constructor(
    private readonly remoteRoot: Uri,
    private readonly branchRoot: Uri,
    private readonly checkoutRoot: Uri,
    /** path relative from remoteRoot */
    private readonly _path: string,
    private readonly _revision?: string
  ) {
    if (_path.length === 0 || _path.charAt(0) === "/") {
      throw new Error("Invalid _path " + _path);
    }
  }

  get remoteFullPath(): Uri {
    return Uri.parse(this.remoteRoot.toString() + "/" + this._path);
  }

  get localFullPath(): Uri {
    return Uri.file(
      path.join(
        this.checkoutRoot.path,
        path.relative(this.fromRepoToBranch, this._path)
      )
    );
  }

  get relativeFromBranch(): string {
    return path.relative(this.fromRepoToBranch, this._path);
  }

  get fromRepoToBranch(): string {
    return path.relative(this.remoteRoot.path, this.branchRoot.path);
  }

  get revision(): string | undefined {
    return this._revision;
  }

  public toString(withRevision?: boolean): string {
    return this.remoteFullPath + (withRevision ? this._revision || "" : "");
  }
}
