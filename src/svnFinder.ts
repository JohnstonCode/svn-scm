import * as cp from "child_process";
import * as path from "path";
import * as semver from "semver";
import { cpErrorHandler } from "./svn";

export interface ISvn {
  path: string;
  version: string;
}

export class SvnFinder {
  public findSvn(hint?: string): Promise<ISvn> {
    const first = hint
      ? this.findSpecificSvn(hint)
      : Promise.reject<ISvn>(null);

    return first
      .then(void 0, () => {
        switch (process.platform) {
          case "darwin":
            return this.findSvnDarwin();
          case "win32":
            return this.findSvnWin32();
          default:
            return this.findSpecificSvn("svn");
        }
      })
      .then(svn => this.checkSvnVersion(svn))
      .then(null, () =>
        Promise.reject(new Error("Svn installation not found."))
      );
  }

  public findSvnWin32(): Promise<ISvn> {
    return this.findSystemSvnWin32(process.env.ProgramW6432)
      .then(void 0, () =>
        this.findSystemSvnWin32(process.env["ProgramFiles(x86)"])
      )
      .then(void 0, () => this.findSystemSvnWin32(process.env.ProgramFiles))
      .then(void 0, () => this.findSpecificSvn("svn"));
  }

  public findSystemSvnWin32(base?: string): Promise<ISvn> {
    if (!base) {
      return Promise.reject<ISvn>("Not found");
    }

    return this.findSpecificSvn(
      path.join(base, "TortoiseSVN", "bin", "svn.exe")
    );
  }

  public findSvnDarwin(): Promise<ISvn> {
    return new Promise<ISvn>((c, e) => {
      cp.exec("which svn", (err, svnPathBuffer) => {
        if (err) {
          return e("svn not found");
        }

        const path = svnPathBuffer.toString().replace(/^\s+|\s+$/g, "");

        function getVersion(path: string) {
          // make sure svn executes
          cp.exec("svn --version --quiet", (err, stdout) => {
            if (err) {
              return e("svn not found");
            }

            return c({ path, version: stdout.trim() });
          });
        }

        if (path !== "/usr/bin/svn") {
          return getVersion(path);
        }

        // must check if XCode is installed
        cp.exec("xcode-select -p", (err: any) => {
          if (err && err.code === 2) {
            // svn is not installed, and launching /usr/bin/svn
            // will prompt the user to install it

            return e("svn not found");
          }

          getVersion(path);
        });
      });
    });
  }

  public findSpecificSvn(path: string): Promise<ISvn> {
    return new Promise<ISvn>((c, e) => {
      const buffers: Buffer[] = [];
      const child = cp.spawn(path, ["--version", "--quiet"]);
      child.stdout.on("data", (b: Buffer) => buffers.push(b));
      child.on("error", cpErrorHandler(e));
      child.on("close", code =>
        code
          ? e(new Error("Not found"))
          : c({
              path,
              version: Buffer.concat(buffers)
                .toString("utf8")
                .trim()
            })
      );
    });
  }

  public checkSvnVersion(svn: ISvn): Promise<ISvn> {
    return new Promise<ISvn>((c, e) => {
      // fix compatibility with SlickSVN (like 1.6.17-SlikSvn-tag-1.6.17@1130898-X64)
      const version = svn.version.replace(/^(\d+\.\d+\.\d+).*/, "$1");
      if (!semver.valid(version)) {
        e(new Error("Invalid svn version"));
      } else if (!semver.gte(version, "1.6.0")) {
        e(new Error("Required svn version must be >= 1.6"));
      } else {
        c(svn);
      }
    });
  }
}
