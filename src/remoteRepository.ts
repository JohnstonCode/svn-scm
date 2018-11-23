import { Uri } from "vscode";
import { ISvnInfo, ISvnLogEntry } from "./common/types";
import { PathNormalizer } from "./pathNormalizer";
import { Repository as BaseRepository } from "./svnRepository";

export interface IRemoteRepository {
  branchRoot: Uri;

  getPathNormalizer(): PathNormalizer;

  log(
    rfrom: string,
    rto: string,
    limit: number,
    target?: string | Uri
  ): Promise<ISvnLogEntry[]>;

  show(filePath: string | Uri, revision?: string): Promise<string>;
}

export class RemoteRepository implements IRemoteRepository {
  public static async open(uri: Uri): Promise<RemoteRepository> {
    throw new Error("unimplemted");
  }
  private constructor(private info: ISvnInfo) {}

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
    target?: string | Uri
  ): Promise<ISvnLogEntry[]> {
    return [];
  }

  public async show(
    filePath: string | Uri,
    revision?: string
  ): Promise<string> {
    return "";
  }
}
