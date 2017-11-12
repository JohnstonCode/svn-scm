import { window } from "vscode";
import * as cp from "child_process";
import * as iconv from "iconv-lite";

interface CpOptions {
  cwd?: string;
  encoding?: string;
}

export class Svn {
  constructor() {
    this.isSvnAvailable();
  }

  async exec(cwd: string, args: any[], options: CpOptions = {}) {
    if (cwd) {
      options.cwd = cwd;
    }

    let process = cp.spawn("svn", args, options);

    let [exitCode, stdout, stderr] = await Promise.all<any>([
      new Promise<number>((resolve, reject) => {
        process.once("error", reject);
        process.once("exit", resolve);
      }),
      new Promise<Buffer>(resolve => {
        const buffers: Buffer[] = [];
        process.stdout.on("data", (b: Buffer) => buffers.push(b));
        process.stdout.once("close", () => resolve(Buffer.concat(buffers)));
      }),
      new Promise<string>(resolve => {
        const buffers: Buffer[] = [];
        process.stderr.on("data", (b: Buffer) => buffers.push(b));
        process.stderr.once("close", () =>
          resolve(Buffer.concat(buffers).toString())
        );
      })
    ]);

    let encoding = options.encoding || "utf8";
    encoding = iconv.encodingExists(encoding) ? encoding : "utf8";

    stdout = iconv.decode(stdout, encoding);

    return { exitCode, stdout, stderr };
  }

  async getRepositoryRoot(path: string) {
    try {
      let result = await this.exec(path, ["info", "--xml"]);
      let rootPath = result.stdout.match(
        /<wcroot-abspath>(.*)<\/wcroot-abspath>/i
      )[1];
      return rootPath;
    } catch (error) {
      throw new Error("Unable to find repository root path");
    }
  }

  private isSvnAvailable() {
    return new Promise((resolve, reject) => {
      this.exec("", ["--version"])
        .then(result => {
          resolve();
        })
        .catch(result => {
          reject();
        });
    });
  }

  open(repositoryRoot: string, workspaceRoot: string): Repository {
    return new Repository(this, repositoryRoot, workspaceRoot);
  }

  add(path: string) {
    path = path.replace(/\\/g, "/");
    return this.exec("", ["add", path]);
  }

  show(path: string, options: CpOptions = {}) {
    return this.exec("", ["cat", "-r", "HEAD", path], options);
  }

  list(path: string) {
    return this.exec("", ["ls", path]);
  }

  commit(message: string, files: any[]) {
    let args = ["commit", "-m", message];

    for (let file of files) {
      args.push(file);
    }

    return this.exec("", args);
  }

  ls(filePath: string) {
    return this.exec("", ["ls", "--xml", filePath]);
  }
}

export class Repository {
  constructor(
    private svn: Svn,
    public root: string,
    public workspaceRoot: string
  ) {}

  async getStatus(): Promise<any[]> {
    const result = await this.svn.exec(this.workspaceRoot, ["stat"]);

    let items = result.stdout.split("\n");
    let status = [];

    for (let item of items) {
      let state = item.charAt(0);
      let path = item.substr(8).trim();

      status.push([state, path]);
    }

    return status;
  }

  async show(path: string, options: CpOptions = {}): Promise<string> {
    const result = await this.svn.show(path, options);
    return result.stdout;
  }

  async commitFiles(message: string, files: any[]) {
    try {
      return await this.svn.commit(message, files);
    } catch (error) {
      throw new Error("Unable to commit files");
    }
  }
}
