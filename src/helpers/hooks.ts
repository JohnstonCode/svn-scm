import { exec } from "child_process";
import SvnError from "../svnError";

export async function executeHook(hook: string) {
  return new Promise((resolve, reject) => {
    exec(hook, (err, stdout, stderr) => {
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
