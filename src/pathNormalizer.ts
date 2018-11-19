import * as path from "path";
import { Uri } from "vscode";
import { ISvnInfo } from "./common/types";
import { SvnRI } from "./svnRI";

enum ResourceKind {
  LocalRelative,
  LocalFull,
  RemoteFull
}

/**
 * create from Repository class
 */
export class PathNormalizer {
  public readonly repoRoot: Uri;
  public readonly branchRoot: Uri;
  public readonly checkoutRoot: Uri;
  constructor(public readonly repoInfo: ISvnInfo) {
    this.repoRoot = Uri.parse(repoInfo.repository.root);
    this.branchRoot = Uri.parse(repoInfo.url);
    this.checkoutRoot = Uri.file(repoInfo.wcInfo.wcrootAbspath);
  }

  public parse(fpath: string, kind?: ResourceKind, rev?: string): SvnRI {
    let target: string;
    if (kind === undefined) {
      target = fpath;
      if (fpath.startsWith("^/")) {
        target = fpath.substr(2);
      } else if (fpath.startsWith("/")) {
        target = fpath.substr(1);
      } else if (fpath.startsWith("svn://") || fpath.startsWith("file://")) {
        target = Uri.parse(fpath).path.substr(1);
      }
      const match = /(.+)@(\d+)$/.exec(target);
      if (match !== null) {
        target = match[0];
        rev = match[1];
      }
    } else if (kind === ResourceKind.LocalFull) {
      if (!path.isAbsolute(fpath)) {
        throw new Error("Path isn't absolute");
      }
      target = path.join(
        this.fromRootToBranch(),
        path.relative(this.checkoutRoot.path, fpath)
      );
    } else if (kind === ResourceKind.LocalRelative) {
      if (path.isAbsolute(fpath)) {
        throw new Error("Path is absolute");
      }
      target = path.join(this.fromRootToBranch(), fpath);
    } else if (kind === ResourceKind.RemoteFull) {
      target = fpath;
    } else {
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

  public fromRootToBranch(): string {
    return path.relative(this.repoRoot.path, this.branchRoot.path);
  }

  public fromBranchToRoot(): string {
    return path.relative(this.branchRoot.path, this.repoRoot.path);
  }
}
