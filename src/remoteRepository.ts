import { Uri } from "vscode";
import { ISvnInfo, ISvnLogEntry } from "./common/types";
import { memoize } from "./decorators";
import { PathNormalizer, ResourceKind } from "./pathNormalizer";
import { Svn } from "./svn";
import { Repository as BaseRepository } from "./svnRepository";
import { SvnRI } from "./svnRI";

export interface ITarget {
  isLocal: boolean;
  revision?: string;
  rscKind: ResourceKind;
  path: string | Uri;
}

export interface IRemoteRepository {
  branchRoot: Uri;

  getPathNormalizer(): PathNormalizer;

  log(
    rfrom: string,
    rto: string,
    limit: number,
    target?: ITarget,
  ): Promise<ISvnLogEntry[]>;

  show(
    target: ITarget,
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
    target?: ITarget,
  ): Promise<ISvnLogEntry[]> {
    const pn = this.getPathNormalizer();
    let ri: SvnRI | undefined;
    if (target !== undefined) {
      ri = pn.parse(target.path.toString(true), target.rscKind, target.revision);
    }
    return this.repo.log(rfrom, rto, limit, ri);
  }

  public async show(
    target: ITarget,
    revision?: string
  ): Promise<string> {
    const pn = this.getPathNormalizer();
    return this.repo.show(
      pn.parse(target.path.toString(true), target.rscKind, revision),
      target.isLocal,
      revision
    );
  }
}
