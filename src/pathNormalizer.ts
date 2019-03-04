import { posix as path } from "path";
import * as nativepath from "path";
import { Uri } from "vscode";
import { ISvnInfo } from "./common/types";
import { memoize } from "./decorators";
import { pathOrRoot, SvnRI } from "./svnRI";

export enum ResourceKind {
  LocalRelative,
  LocalFull,
  RemoteFull
}

function removeSchema(url: string): string {
  return url.replace(/^\w+:\/\//, "");
}

/**
 * create from Repository class
 */
export class PathNormalizer {
  public readonly repoRoot: Uri;
  public readonly branchRoot: Uri;
  public readonly checkoutRoot?: Uri;

  constructor(public readonly repoInfo: ISvnInfo) {
    this.repoRoot = Uri.parse(repoInfo.repository.root);
    this.branchRoot = Uri.parse(repoInfo.url);
    if (repoInfo.wcInfo) {
      this.checkoutRoot = Uri.file(repoInfo.wcInfo.wcrootAbspath);
    }
  }

  /** svn://foo.org/domain/trunk/x -> trunk/x */
  private getFullRepoPathFromUrl(fpath: string): string {
    if (fpath.startsWith("/")) {
      return fpath.substr(1);
    } else if (fpath.startsWith("svn://") || fpath.startsWith("file://")) {
      const target = Uri.parse(fpath).path;
      return nativepath
        .relative(pathOrRoot(this.repoRoot), target)
        .replace("\\", "/");
    } else {
      throw new Error("unknown path");
    }
  }

  public parse(
    fpath: string,
    kind = ResourceKind.RemoteFull,
    rev?: string
  ): SvnRI {
    let target: string;
    switch (kind) {
      case ResourceKind.RemoteFull:
        target = this.getFullRepoPathFromUrl(fpath);
        break;
      case ResourceKind.LocalFull:
      case ResourceKind.LocalRelative:
        if (
          nativepath.isAbsolute(fpath) !==
          (kind === ResourceKind.LocalFull)
        ) {
          throw new Error("Path absolute error");
        }
        if (this.checkoutRoot === undefined) {
          throw new Error("Local path is not supported in remote repository");
        }
        target = removeSchema(fpath);
        if (kind === ResourceKind.LocalFull) {
          target = nativepath.relative(this.checkoutRoot.fsPath, fpath);
        }
        target = path.join(this.fromRootToBranch(), target);
        break;
      default:
        throw new Error("unsupported kind");
    }

    return new SvnRI(
      this.repoRoot,
      this.branchRoot,
      this.checkoutRoot,
      target,
      rev
    );
  }

  @memoize
  public fromRootToBranch(): string {
    return path.relative(
      pathOrRoot(this.repoRoot),
      pathOrRoot(this.branchRoot)
    );
  }

  @memoize
  public fromBranchToRoot(): string {
    return path.relative(
      pathOrRoot(this.branchRoot),
      pathOrRoot(this.repoRoot)
    );
  }
}
