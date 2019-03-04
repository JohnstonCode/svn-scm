import { Uri } from "vscode";
import { ISvnInfo, ISvnLogEntry } from "./common/types";
import { memoize } from "./decorators";
import { PathNormalizer, ResourceKind } from "./pathNormalizer";
import { Svn } from "./svn";
import { Repository as BaseRepository } from "./svnRepository";
import { SvnRI } from "./svnRI";

export interface IRemoteRepository {
  branchRoot: Uri;

  getPathNormalizer(): PathNormalizer;

  log(
    rfrom: string,
    rto: string,
    limit: number,
    target?: string | Uri,
    rscKind?: ResourceKind
  ): Promise<ISvnLogEntry[]>;

  show(
    filePath: string | Uri,
    rscKind: ResourceKind,
    revision?: string
  ): Promise<string>;
}

export class RemoteRepository implements IRemoteRepository {
  private info: ISvnInfo;
  private constructor(private repo: BaseRepository) {
    this.info = repo.info;
  }

  public static async open(svn: Svn, uri: Uri): Promise<RemoteRepository> {
    const repo = await svn.open(uri.toString(true), "");
    return new RemoteRepository(repo);
  }

  @memoize
  public getPathNormalizer(): PathNormalizer {
    return new PathNormalizer(this.info);
  }

  public get branchRoot(): Uri {
    return Uri.parse(this.info.url);
  }

  public async log(
    rfrom: string,
    rto: string,
    limit: number,
    target?: string | Uri,
    rscKind?: ResourceKind
  ): Promise<ISvnLogEntry[]> {
    const pn = this.getPathNormalizer();
    let ri: SvnRI | undefined;
    if (target !== undefined) {
      ri = pn.parse(target.toString(true), rscKind, rfrom);
    }
    return this.repo.log(rfrom, rto, limit, ri);
  }

  public async show(
    filePath: string | Uri,
    rscKind: ResourceKind,
    revision?: string
  ): Promise<string> {
    const pn = this.getPathNormalizer();
    return this.repo.show(
      pn.parse(filePath.toString(true), rscKind, revision),
      rscKind !== ResourceKind.RemoteFull,
      revision
    );
  }
}
