import { exec } from "child_process";
import { Repository } from "../repository";
import SvnError from "../svnError";

export interface IHook {
  project?: string;
  branch?: string;
  commands: Array<string> | string;
}

export default class Hook {
  public project?: string;
  public branch?: string;
  public commands: Array<string>;

  constructor(data: IHook) {
    this.project = data.project;
    this.branch = data.branch;
    if (Array.isArray(data.commands)) {
      this.commands = data.commands.slice();
    } else {
      this.commands = new Array<string>();
      this.commands.push(data.commands);
    }
  }

  private async _execute(command: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      exec(command, (err, stdout, stderr) => {
        if (err) {
          reject(
            new SvnError({
              message: "Failed to execute svn",
              stdout: stdout,
              stderr: stderr,
              stderrFormated: stderr.replace(/^svn: E\d+: +/gm, "")
            })
          );
          return;
        } else {
          resolve(stdout);
        }
      });
    });
  }

  public async execute(repository: Repository) {
    console.log(repository);

    if (this.project !== undefined && !repository.root.includes(this.project)) {
      return;
    }

    if (this.branch !== repository.currentBranch && this.branch !== undefined) {
      return;
    }

    for (const command of this.commands) {
      await this._execute(command);
    }
  }
}
