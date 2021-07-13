import { exec } from "child_process";
import { commands } from "vscode";
import { Operation } from "../common/types";
import SvnError from "../svnError";

export enum Disposition {
  Pre = "Pre",
  Post = "Post"
}

export enum Command {
  System = "System",
  VSCode = "VSCode"
}

export enum OperationArgs {
  None = "None",
  ReadOnly = "ReadOnly",
  ReadWrite = "ReadWrite"
}

export interface IHook {
  commandType: Command;
  commandDisposition: Disposition;
  commandOperation: Operation;
  commandArguments: Array<any> | string;
  command: Array<string> | string;
  operationArguments: OperationArgs;
  project?: string;
  branch?: string;
}

export default class Hook implements IHook {
  commandType: Command;
  commandDisposition: Disposition;
  commandOperation: Operation;
  commandArguments: Array<any>;
  command: Array<string>;
  operationArguments: OperationArgs;
  project?: string;
  branch?: string;

  constructor(data: IHook) {
    this.commandType = data.commandType;
    this.commandDisposition = data.commandDisposition;
    this.commandOperation = data.commandOperation;
    this.commandArguments = Array.isArray(data.commandArguments)
      ? data.commandArguments.slice()
      : new Array<string>(`${data.commandArguments}`);
    this.command = Array.isArray(data.command)
      ? data.command.slice()
      : new Array<string>(`${data.command}`);

    this.operationArguments = data.operationArguments;

    this.project = data.project;
    this.branch = data.branch;
  }

  private async _execute(
    command: string,
    args?: string[],
    operationArgs?: any
  ): Promise<unknown> {
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
              this.operationArguments === OperationArgs.ReadWrite &&
                Object.assign(operationArgs, JSON.parse(stdout));
              resolve(stdout);
            }
          });
        });

      case Command.VSCode:
        return new Promise((resolve, reject) => {
          commands.executeCommand(command, ...(args || [])).then(
            value => {
              this.operationArguments === OperationArgs.ReadWrite &&
                Object.assign(operationArgs, value);
              resolve(value);
            },
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

  public async execute(operationArgs: any = {}) {
    for (const command of this.command) {
      const _command =
        this.operationArguments === OperationArgs.None
          ? command
          : String(command).replace(
              "${opArgs}",
              `${JSON.stringify(operationArgs)}`
            );

      await this._execute(_command, this.commandArguments, operationArgs);
    }
  }
}
