import { exec } from "child_process";
import { commands } from "vscode";
import { Operation } from "../common/types";
import { Repository } from "../repository";
import SvnError from "../svnError";

export enum Disposition {
  Pre = "Pre",
  Post = "Post"
}

export enum Command {
  System = "System",
  VSCode = "VSCode"
}

export interface IHook {
  commandType: Command;
  commandDisposition: Disposition;
  commandOperation: Operation;
  command: Array<string> | string;
  project?: string;
  branch?: string;
}

export default class Hook implements IHook {
  commandType: Command;
  commandDisposition: Disposition;
  commandOperation: Operation;
  command: Array<string> | string;
  project?: string;
  branch?: string;

  constructor(data: IHook) {
    this.commandType = data.commandType;
    this.commandDisposition = data.commandDisposition;
    this.commandOperation = data.commandOperation;
    this.command = Array.isArray(data.command)
      ? data.command.slice()
      : new Array<string>(`${data.command}`);

    this.project = data.project;
    this.branch = data.branch;
  }

  private async _execute(command: string): Promise<unknown> {
    switch (this.commandType) {
      case Command.System:
        return new Promise((resolve, reject) => {
          exec(command, (err, stdout, stderr) => {
            if (err) {
              reject(
                new SvnError({
                  message: "Failed to execute hook",
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

      case Command.VSCode:
        return new Promise((resolve, reject) => {
          commands.executeCommand(command).then(
            value => resolve(value),
            reason =>
              reject(
                new SvnError({
                  message: "Failed to execute hook",
                  stdout: "",
                  stderr: reason.stack,
                  stderrFormated: reason.message
                })
              )
          );
        });

      default:
        throw new Error(
          "The command should be either a System call or a VS Code command."
        );
    }
  }

  public async execute(
    operation: Operation,
    repository: Repository,
    disposition: Disposition
  ) {
    if (this.commandOperation !== operation) {
      return;
    }

    if (this.commandDisposition !== disposition) {
      return;
    }

    if (this.project !== undefined && !repository.root.includes(this.project)) {
      return;
    }

    if (this.branch !== repository.currentBranch && this.branch !== undefined) {
      return;
    }

    for (const command of this.command) {
      await this._execute(command);
    }
  }
}
