import { ISvnErrorData } from "./common/types";

export default class SvnError {
  public error?: Error;
  public message: string;
  public stdout?: string;
  public stderr?: string;
  public stderrFormated?: string;
  public exitCode?: number;
  public svnErrorCode?: string;
  public svnCommand?: string;

  constructor(data: ISvnErrorData) {
    if (data.error) {
      this.error = data.error;
      this.message = data.error.message;
    } else {
      this.error = void 0;
    }

    this.message = data.message || "SVN error";
    this.stdout = data.stdout;
    this.stderr = data.stderr;
    this.stderrFormated = data.stderrFormated;
    this.exitCode = data.exitCode;
    this.svnErrorCode = data.svnErrorCode;
    this.svnCommand = data.svnCommand;
  }

  public toString(): string {
    let result =
      this.message +
      " " +
      JSON.stringify(
        {
          exitCode: this.exitCode,
          svnErrorCode: this.svnErrorCode,
          svnCommand: this.svnCommand,
          stdout: this.stdout,
          stderr: this.stderr
        },
        null,
        2
      );

    if (this.error) {
      result += (this.error as any).stack;
    }

    return result;
  }
}
