import * as path from "path";
import { Uri } from "vscode";
import { memoize } from "./decorators";

export class SvnRI {
  constructor(
    private readonly remoteRoot: Uri,
    private readonly branchRoot: Uri,
    private readonly checkoutRoot: Uri | undefined,
    /** path relative from remoteRoot */
    private readonly _path: string,
    private readonly _revision?: string
  ) {
    if (_path.length === 0 || _path.charAt(0) === "/") {
      throw new Error("Invalid _path " + _path);
    }
  }

  @memoize
  get remoteFullPath(): Uri {
    return Uri.parse(this.remoteRoot.toString() + "/" + this._path);
  }

  @memoize
  get localFullPath(): Uri | undefined {
    if (this.checkoutRoot === undefined) {
      return undefined;
    }
    return Uri.file(
      path.join(
        this.checkoutRoot.path,
        path.relative(this.branchRoot.path, "/" + this._path)
      )
    );
  }

  @memoize
  get relativeFromBranch(): string {
    return path.relative(this.fromRepoToBranch, this._path);
  }

  @memoize
  get fromRepoToBranch(): string {
    return path.relative(this.remoteRoot.path, this.branchRoot.path);
  }

  @memoize
  get revision(): string | undefined {
    return this._revision;
  }

  @memoize
  public toString(withRevision?: boolean): string {
    return this.remoteFullPath + (withRevision ? this._revision || "" : "");
  }
}
