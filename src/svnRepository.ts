import * as path from "path";
import * as tmp from "tmp";
import { Uri, workspace } from "vscode";
import {
  ConstructorPolicy,
  ICpOptions,
  IExecutionResult,
  IFileStatus,
  ISvnInfo,
  ISvnLogEntry,
  Status,
  SvnDepth,
  ISvnPathChange,
  ISvnPath,
  ISvnListItem
} from "./common/types";
import { sequentialize } from "./decorators";
import * as encodeUtil from "./encoding";
import { exists, writeFile, stat, readdir } from "./fs";
import { getBranchName } from "./helpers/branch";
import { configuration } from "./helpers/configuration";
import { parseInfoXml } from "./parser/infoParser";
import { parseSvnList } from "./parser/listParser";
import { parseSvnLog } from "./parser/logParser";
import { parseStatusXml } from "./parser/statusParser";
import { Svn, BufferResult } from "./svn";
import {
  fixPathSeparator,
  fixPegRevision,
  isDescendant,
  normalizePath,
  unwrap
} from "./util";
import { matchAll } from "./util/globMatch";
import { parseDiffXml } from "./parser/diffParser";

export class Repository {
  private _infoCache: {
    [index: string]: ISvnInfo;
  } = {};
  private _info?: ISvnInfo;

  public username?: string;
  public password?: string;

  constructor(
    private svn: Svn,
    public root: string,
    public workspaceRoot: string,
    policy: ConstructorPolicy
  ) {
    if (policy === ConstructorPolicy.LateInit) {
      return ((async (): Promise<Repository> => {
        return this;
      })() as unknown) as Repository;
    }
    return ((async (): Promise<Repository> => {
      await this.updateInfo();
      return this;
    })() as unknown) as Repository;
  }

  public async updateInfo() {
    const result = await this.exec([
      "info",
      "--xml",
      fixPegRevision(this.workspaceRoot ? this.workspaceRoot : this.root)
    ]);

    this._info = await parseInfoXml(result.stdout);
  }

  public async exec(
    args: string[],
    options: ICpOptions = {}
  ): Promise<IExecutionResult> {
    options.username = this.username;
    options.password = this.password;

    return this.svn.exec(this.workspaceRoot, args, options);
  }

  public async execBuffer(
    args: string[],
    options: ICpOptions = {}
  ): Promise<BufferResult> {
    options.username = this.username;
    options.password = this.password;

    return this.svn.execBuffer(this.workspaceRoot, args, options);
  }

  public removeAbsolutePath(file: string) {
    file = fixPathSeparator(file);

    file = path.relative(this.workspaceRoot, file);

    if (file === "") {
      file = ".";
    }

    return fixPegRevision(file);
  }

  public async getStatus(params: {
    includeIgnored?: boolean;
    includeExternals?: boolean;
    checkRemoteChanges?: boolean;
  }): Promise<IFileStatus[]> {
    params = Object.assign(
      {},
      {
        includeIgnored: false,
        includeExternals: true,
        checkRemoteChanges: false
      },
      params
    );

    const args = ["stat", "--xml"];

    if (params.includeIgnored) {
      args.push("--no-ignore");
    }
    if (!params.includeExternals) {
      args.push("--ignore-externals");
    }
    if (params.checkRemoteChanges) {
      args.push("--show-updates");
    }

    const result = await this.exec(args);

    const status: IFileStatus[] = await parseStatusXml(result.stdout);

    for (const s of status) {
      if (s.status === Status.EXTERNAL) {
        try {
          const info = await this.getInfo(s.path);
          s.repositoryUuid = info.repository.uuid;
        } catch (error) {
          console.error(error);
        }
      }
    }

    return status;
  }

  public get info(): ISvnInfo {
    return unwrap(this._info);
  }

  public resetInfoCache(file: string = "") {
    delete this._infoCache[file];
  }

  @sequentialize
  public async getInfo(
    file: string = "",
    revision?: string,
    skipCache: boolean = false,
    isUrl: boolean = false
  ): Promise<ISvnInfo> {
    if (!skipCache && this._infoCache[file]) {
      return this._infoCache[file];
    }

    const args = ["info", "--xml"];

    if (revision) {
      args.push("-r", revision);
    }

    if (file) {
      if (!isUrl) {
        file = fixPathSeparator(file);
      }
      args.push(file);
    }

    const result = await this.exec(args);

    this._infoCache[file] = await parseInfoXml(result.stdout);

    // Cache for 2 minutes
    setTimeout(() => {
      this.resetInfoCache(file);
    }, 2 * 60 * 1000);

    return this._infoCache[file];
  }

  public async getChanges(): Promise<ISvnPathChange[]> {
    // First, check to see if this branch was copied from somewhere.
    let args = [
      "log",
      "-r1:HEAD",
      "--stop-on-copy",
      "--xml",
      "--with-all-revprops",
      "--verbose"
    ];
    let result = await this.exec(args);
    const entries = await parseSvnLog(result.stdout);

    if (entries.length === 0 || entries[0].paths.length === 0) {
      return [];
    }

    const copyCommitPath = entries[0].paths[0];

    if (
      typeof copyCommitPath.copyfromRev === "undefined" ||
      typeof copyCommitPath.copyfromPath === "undefined" ||
      typeof copyCommitPath._ === "undefined" ||
      copyCommitPath.copyfromRev.trim().length === 0 ||
      copyCommitPath.copyfromPath.trim().length === 0 ||
      copyCommitPath._.trim().length === 0
    ) {
      return [];
    }

    const copyFromPath = copyCommitPath.copyfromPath;
    const copyFromRev = copyCommitPath.copyfromRev;
    const copyToPath = copyCommitPath._;
    const copyFromUrl = this.info.repository.root + copyFromPath;
    const copyToUrl = this.info.repository.root + copyToPath;

    // Get last merge revision from path that this branch was copied from.
    args = ["mergeinfo", "--show-revs=merged", copyFromUrl, copyToUrl];
    result = await this.exec(args);
    const revisions = result.stdout.trim().split("\n");
    let latestMergedRevision: string = "";

    if (revisions.length) {
      latestMergedRevision = revisions[revisions.length - 1];
    }

    if (latestMergedRevision.trim().length === 0) {
      latestMergedRevision = copyFromRev;
    }

    // Now, diff the source branch at the latest merged revision with the current branch's revision
    const info = await this.getInfo(copyToUrl, undefined, true, true);
    args = [
      "diff",
      `${copyFromUrl}@${latestMergedRevision}`,
      copyToUrl,
      "--ignore-properties",
      "--xml",
      "--summarize"
    ];
    result = await this.exec(args);
    let paths: ISvnPath[];
    try {
      paths = await parseDiffXml(result.stdout);
    } catch (err) {
      return [];
    }

    const changes: ISvnPathChange[] = [];

    // Now, we have all the files that this branch changed.
    for (const path of paths) {
      changes.push({
        oldPath: Uri.parse(path._),
        newPath: Uri.parse(path._.replace(copyFromUrl, copyToUrl)),
        oldRevision: latestMergedRevision.replace("r", ""),
        newRevision: info.revision,
        item: path.item,
        props: path.props,
        kind: path.kind,
        repo: Uri.parse(this.info.repository.root),
        localPath: Uri.parse(path._.replace(copyFromUrl, ""))
      });
    }

    return changes;
  }

  public async show(file: string | Uri, revision?: string): Promise<string> {
    const args = ["cat"];

    let uri: Uri;
    let filePath: string;

    if (file instanceof Uri) {
      uri = file;
      filePath = file.toString(true);
    } else {
      uri = Uri.file(file);
      filePath = file;
    }

    const isChild =
      uri.scheme === "file" && isDescendant(this.workspaceRoot, uri.fsPath);

    let target: string = filePath;

    if (isChild) {
      target = this.removeAbsolutePath(target);
    }

    if (revision) {
      args.push("-r", revision);
      if (
        isChild &&
        !["BASE", "COMMITTED", "PREV"].includes(revision.toUpperCase())
      ) {
        const info = await this.getInfo();
        target = info.url + "/" + target.replace(/\\/g, "/");
        // TODO move to SvnRI
      }
    }

    args.push(target);

    /**
     * ENCODE DETECTION
     * if TextDocuments exists and autoGuessEncoding is true,
     * try detect current encoding of content
     */
    const configs = workspace.getConfiguration("files", uri);

    let encoding: string | undefined | null = configs.get("encoding");
    let autoGuessEncoding: boolean = configs.get<boolean>(
      "autoGuessEncoding",
      false
    );

    const textDocument = workspace.textDocuments.find(
      doc => normalizePath(doc.uri.fsPath) === normalizePath(filePath)
    );

    if (textDocument) {
      // Load encoding by languageId
      const languageConfigs = workspace.getConfiguration(
        `[${textDocument.languageId}]`,
        uri
      );
      if (languageConfigs["files.encoding"] !== undefined) {
        encoding = languageConfigs["files.encoding"];
      }
      if (languageConfigs["files.autoGuessEncoding"] !== undefined) {
        autoGuessEncoding = languageConfigs["files.autoGuessEncoding"];
      }

      if (autoGuessEncoding) {
        // The `getText` return a `utf-8` string
        const buffer = Buffer.from(textDocument.getText(), "utf-8");
        const detectedEncoding = encodeUtil.detectEncoding(buffer);
        if (detectedEncoding) {
          encoding = detectedEncoding;
        }
      }
    } else {
      const svnEncoding: string | undefined = configuration.get<string>(
        "default.encoding"
      );
      if (svnEncoding) {
        encoding = svnEncoding;
      }
    }

    const experimental = configuration.get<boolean>(
      "experimental.detect_encoding",
      false
    );
    if (experimental) {
      encoding = null;
    }

    const result = await this.exec(args, { encoding });

    return result.stdout;
  }

  public async showBuffer(
    file: string | Uri,
    revision?: string
  ): Promise<Buffer> {
    const args = ["cat"];

    let uri: Uri;
    let filePath: string;

    if (file instanceof Uri) {
      uri = file;
      filePath = file.toString(true);
    } else {
      uri = Uri.file(file);
      filePath = file;
    }

    const isChild =
      uri.scheme === "file" && isDescendant(this.workspaceRoot, uri.fsPath);

    let target: string = filePath;

    if (isChild) {
      target = this.removeAbsolutePath(target);
    }

    if (revision) {
      args.push("-r", revision);
      if (
        isChild &&
        !["BASE", "COMMITTED", "PREV"].includes(revision.toUpperCase())
      ) {
        const info = await this.getInfo();
        target = info.url + "/" + target.replace(/\\/g, "/");
        // TODO move to SvnRI
      }
    }

    args.push(target);

    const result = await this.execBuffer(args);

    return result.stdout;
  }

  public async commitFiles(message: string, files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));

    const args = ["commit", ...files];

    if (await exists(path.join(this.workspaceRoot, message))) {
      args.push("--force-log");
    }

    let tmpFile: tmp.FileResult | undefined;

    /**
     * For message with line break or non:
     * \x00-\x7F -> ASCII
     * \x80-\xFF -> Latin
     * Use a file for commit message
     */
    if (/\n|[^\x00-\x7F\x80-\xFF]/.test(message)) {
      tmp.setGracefulCleanup();

      tmpFile = tmp.fileSync({
        prefix: "svn-commit-message-"
      });

      await writeFile(tmpFile.name, message, "UTF-8");

      args.push("-F", tmpFile.name);
      args.push("--encoding", "UTF-8");
    } else {
      args.push("-m", message);
    }

    // Prevents commit the files inside the folder
    args.push("--depth", "empty");

    const result = await this.exec(args);

    // Remove temporary file if exists
    if (tmpFile) {
      tmpFile.removeCallback();
    }

    const matches = result.stdout.match(/Committed revision (.*)\./i);
    if (matches && matches[0]) {
      const sendedFiles = (
        result.stdout.match(/(Sending|Adding|Deleting)\s+/g) || []
      ).length;

      const filesMessage = `${sendedFiles} ${
        sendedFiles === 1 ? "file" : "files"
      } commited`;

      return `${filesMessage}: revision ${matches[1]}.`;
    }

    return result.stdout;
  }

  public async addFilesByIgnore(files: string[], ignoreList: string[]) {
    const allFiles = async (file: string): Promise<string[]> => {
      if ((await stat(file)).isDirectory()) {
        return (
          await Promise.all(
            (await readdir(file)).map(subfile => {
              const abspath = path.resolve(file + path.sep + subfile);
              const relpath = this.removeAbsolutePath(abspath);
              if (
                !matchAll(path.sep + relpath, ignoreList, {
                  dot: true,
                  matchBase: true
                })
              ) {
                return allFiles(abspath);
              }
              return [];
            })
          )
        ).reduce((acc, cur) => acc.concat(cur), [file]);
      }
      return [file];
    };
    files = (await Promise.all(files.map(file => allFiles(file)))).flat();
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["add", "--depth=empty", ...files]);
  }

  public addFiles(files: string[]) {
    const ignoreList = configuration.get<string[]>("sourceControl.ignore");
    if (ignoreList.length > 0) {
      return this.addFilesByIgnore(files, ignoreList);
    }
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["add", ...files]);
  }

  public addChangelist(files: string[], changelist: string) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["changelist", changelist, ...files]);
  }

  public removeChangelist(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    return this.exec(["changelist", "--remove", ...files]);
  }

  public async getCurrentBranch(): Promise<string> {
    const info = await this.getInfo();

    const branch = getBranchName(info.url);

    if (branch) {
      const showFullName = configuration.get<boolean>("layout.showFullName");
      if (showFullName) {
        return branch.path;
      } else {
        return branch.name;
      }
    }

    return "";
  }

  public async getRepositoryUuid(): Promise<string> {
    const info = await this.getInfo();

    return info.repository.uuid;
  }

  public async getRepoUrl() {
    const info = await this.getInfo();

    const branch = getBranchName(info.url);

    if (!branch) {
      return info.repository.root;
    }

    const regex = new RegExp(branch.path + "$");

    return info.url.replace(regex, "").replace(/\/$/, "");
  }

  public async getBranches() {
    const trunkLayout = configuration.get<string>("layout.trunk");
    const branchesLayout = configuration.get<string>("layout.branches");
    const tagsLayout = configuration.get<string>("layout.tags");

    const repoUrl = await this.getRepoUrl();

    const branches: string[] = [];

    const promises = [];

    if (trunkLayout) {
      promises.push(
        new Promise<string[]>(async resolve => {
          try {
            await this.exec([
              "ls",
              repoUrl + "/" + trunkLayout,
              "--depth",
              "empty"
            ]);

            resolve([trunkLayout]);
          } catch (error) {
            resolve([]);
          }
        })
      );
    }

    const trees: string[] = [];

    if (branchesLayout) {
      trees.push(branchesLayout);
    }

    if (tagsLayout) {
      trees.push(tagsLayout);
    }

    for (const tree of trees) {
      promises.push(
        new Promise<string[]>(async resolve => {
          const branchUrl = repoUrl + "/" + tree;

          try {
            const result = await this.exec(["ls", branchUrl]);

            const list = result.stdout
              .trim()
              .replace(/\/|\\/g, "")
              .split(/[\r\n]+/)
              .filter((x: string) => !!x)
              .map((i: string) => tree + "/" + i);

            resolve(list);
          } catch (error) {
            resolve([]);
          }
        })
      );
    }

    const all = await Promise.all<any>(promises);
    all.forEach(list => {
      branches.push(...list);
    });

    return branches;
  }

  public async newBranch(
    name: string,
    commitMessage: string = "Created new branch"
  ) {
    const repoUrl = await this.getRepoUrl();
    const newBranch = repoUrl + "/" + name;
    const info = await this.getInfo();
    const currentBranch = info.url;

    await this.exec(["copy", currentBranch, newBranch, "-m", commitMessage]);

    await this.switchBranch(name);

    return true;
  }

  public async switchBranch(ref: string, force: boolean = false) {
    const repoUrl = await this.getRepoUrl();
    const branchUrl = repoUrl + "/" + ref;

    await this.exec(
      ["switch", branchUrl].concat(force ? ["--ignore-ancestry"] : [])
    );

    this.resetInfoCache();
    return true;
  }

  public async merge(
    ref: string,
    reintegrate: boolean = false,
    accept_action: string = "postpone"
  ) {
    const repoUrl = await this.getRepoUrl();
    const branchUrl = repoUrl + "/" + ref;

    let args = ["merge", "--accept", accept_action];
    args = args.concat(reintegrate ? ["--reintegrate"] : []);
    args = args.concat([branchUrl]);

    await this.exec(args);

    this.resetInfoCache();
    return true;
  }

  public async revert(files: string[], depth: keyof typeof SvnDepth) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.exec(["revert", "--depth", depth, ...files]);
    return result.stdout;
  }

  public async update(ignoreExternals: boolean = true): Promise<string> {
    const args = ["update"];

    if (ignoreExternals) {
      args.push("--ignore-externals");
    }

    const result = await this.exec(args);

    this.resetInfoCache();

    const message = result.stdout.trim().split(/\r?\n/).pop();

    if (message) {
      return message;
    }
    return result.stdout;
  }

  public async pullIncomingChange(path: string): Promise<string> {
    const args = ["update", path];

    const result = await this.exec(args);

    this.resetInfoCache();

    const message = result.stdout.trim().split(/\r?\n/).pop();

    if (message) {
      return message;
    }
    return result.stdout;
  }

  public async patch(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.exec(["diff", "--internal-diff", ...files]);
    const message = result.stdout;
    return message;
  }

  public async patchBuffer(files: string[]) {
    files = files.map(file => this.removeAbsolutePath(file));
    const result = await this.execBuffer(["diff", "--internal-diff", ...files]);
    const message = result.stdout;
    return message;
  }

  public async patchChangelist(changelistName: string) {
    const result = await this.exec([
      "diff",
      "--internal-diff",
      "--changelist",
      changelistName
    ]);
    const message = result.stdout;
    return message;
  }

  public async removeFiles(files: string[], keepLocal: boolean) {
    files = files.map(file => this.removeAbsolutePath(file));
    const args = ["remove"];

    if (keepLocal) {
      args.push("--keep-local");
    }

    args.push(...files);

    const result = await this.exec(args);

    return result.stdout;
  }

  public async resolve(files: string[], action: string) {
    files = files.map(file => this.removeAbsolutePath(file));

    const result = await this.exec(["resolve", "--accept", action, ...files]);

    return result.stdout;
  }

  public async plainLog(): Promise<string> {
    const logLength = configuration.get<string>("log.length") || "50";
    const result = await this.exec([
      "log",
      "-r",
      "HEAD:1",
      "--limit",
      logLength
    ]);

    return result.stdout;
  }

  public async plainLogBuffer(): Promise<Buffer> {
    const logLength = configuration.get<string>("log.length") || "50";
    const result = await this.execBuffer([
      "log",
      "-r",
      "HEAD:1",
      "--limit",
      logLength
    ]);

    return result.stdout;
  }

  public async plainLogByRevision(revision: number) {
    const result = await this.exec(["log", "-r", revision.toString()]);

    return result.stdout;
  }

  public async plainLogByRevisionBuffer(revision: number) {
    const result = await this.execBuffer(["log", "-r", revision.toString()]);

    return result.stdout;
  }

  public async plainLogByText(search: string) {
    const result = await this.exec(["log", "--search", search]);

    return result.stdout;
  }

  public async plainLogByTextBuffer(search: string) {
    const result = await this.execBuffer(["log", "--search", search]);

    return result.stdout;
  }

  public async log(
    rfrom: string,
    rto: string,
    limit: number,
    target?: string | Uri
  ): Promise<ISvnLogEntry[]> {
    const args = [
      "log",
      "-r",
      `${rfrom}:${rto}`,
      `--limit=${limit}`,
      "--xml",
      "-v"
    ];
    if (target !== undefined) {
      args.push(
        fixPegRevision(target instanceof Uri ? target.toString(true) : target)
      );
    }
    const result = await this.exec(args);

    return parseSvnLog(result.stdout);
  }

  public async logByUser(user: string) {
    const result = await this.exec(["log", "--xml", "-v", "--search", user]);

    return parseSvnLog(result.stdout);
  }

  public async countNewCommit(revision: string = "BASE:HEAD") {
    const result = await this.exec(["log", "-r", revision, "-q", "--xml"]);

    const matches = result.stdout.match(/<logentry/g);

    if (matches && matches.length > 0) {
      // Every return current commit
      return matches.length - 1;
    }

    return 0;
  }

  public async cleanup() {
    const result = await this.exec(["cleanup"]);

    return result.stdout;
  }

  public async removeUnversioned() {
    const result = await this.exec(["cleanup", "--remove-unversioned"]);

    this.svn.logOutput(result.stdout);

    return result.stdout;
  }

  public async finishCheckout() {
    const info = await this.getInfo();

    const result = await this.exec(["switch", info.url]);

    return result.stdout;
  }

  public async list(folder?: string) {
    let url = await this.getRepoUrl();

    if (folder) {
      url += "/" + folder;
    }

    const result = await this.exec(["list", url, "--xml"]);

    return parseSvnList(result.stdout);
  }

  public async ls(file: string): Promise<ISvnListItem[]> {
    const result = await this.exec(["list", file, "--xml"]);

    return parseSvnList(result.stdout);
  }

  public async getCurrentIgnore(directory: string) {
    directory = this.removeAbsolutePath(directory);

    let currentIgnore = "";

    try {
      const args = ["propget", "svn:ignore"];

      if (directory) {
        args.push(directory);
      }

      const currentIgnoreResult = await this.exec(args);

      currentIgnore = currentIgnoreResult.stdout.trim();
    } catch (error) {
      console.error(error);
    }

    const ignores = currentIgnore.split(/[\r\n]+/);

    return ignores;
  }

  public async addToIgnore(
    expressions: string[],
    directory: string,
    recursive: boolean = false
  ) {
    const ignores = await this.getCurrentIgnore(directory);

    directory = this.removeAbsolutePath(directory);

    ignores.push(...expressions);
    const newIgnore = [...new Set(ignores)]
      .filter(v => !!v)
      .sort()
      .join("\n");

    const args = ["propset", "svn:ignore", newIgnore];

    if (directory) {
      args.push(directory);
    } else {
      args.push(".");
    }
    if (recursive) {
      args.push("--recursive");
    }

    const result = await this.exec(args);

    return result.stdout;
  }

  public async rename(oldName: string, newName: string): Promise<string> {
    oldName = this.removeAbsolutePath(oldName);
    newName = this.removeAbsolutePath(newName);
    const args = ["rename", oldName, newName];

    const result = await this.exec(args);

    return result.stdout;
  }
}
