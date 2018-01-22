import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { Uri } from "vscode";
import { SpawnOptions, ChildProcess } from "child_process";

const tempDir = os.tmpdir();
var tempDirList: string[] = [];

export function spawn(
  command: string,
  args?: string[],
  options?: SpawnOptions
): ChildProcess {
  let proc = cp.spawn(command, args, options);

  // let fullCommand = "command: " + command;

  // if (args) {
  //   fullCommand += ' "' + args.join('" "') + '"';
  // }
  // console.log(fullCommand);

  // proc.stdout.on("data", function(data) {
  //   console.log("stdout: " + data.toString());
  // });

  // proc.stderr.on("data", function(data) {
  //   console.log("stderr: " + data.toString());
  // });

  // proc.on("exit", function(code) {
  //   console.log("child process exited with code " + code.toString());
  // });

  return proc;
}

export function newTempDir(prefix: string) {
  const fullpath = fs.mkdtempSync(path.join(tempDir, prefix));

  tempDirList.push(fullpath);

  return fullpath;
}

export function createRepoServer() {
  return new Promise<string>((resolve, reject) => {
    const fullpath = newTempDir("svn_server_");
    const dirname = path.basename(fullpath);

    if (fs.existsSync(fullpath)) {
      destroyPath(fullpath);
    }

    let proc = spawn("svnadmin", ["create", dirname], { cwd: tempDir });

    proc.once("exit", exitCode => {
      if (exitCode === 0) {
        const url = "file:///" + fullpath.replace(/\\/g, "/");
        resolve(url);
      }
      reject();
    });
  });
}

export function importToRepoServer(
  url: string,
  path: string,
  message = "imported",
  cwd?: string
) {
  return new Promise<void>((resolve, reject) => {
    let proc = spawn("svn", ["import", path, url, "-m", message], {
      cwd: cwd
    });

    proc.once("exit", exitCode => {
      if (exitCode === 0) {
        resolve();
      }
      reject();
    });
  });
}

export async function createStandardLayout(
  url: string,
  trunk = "trunk",
  branches = "branches",
  tags = "tags"
) {
  const fullpath = newTempDir("svn_layout_");
  const dirname = path.basename(fullpath);

  fs.mkdirSync(path.join(fullpath, trunk));
  fs.mkdirSync(path.join(fullpath, branches));
  fs.mkdirSync(path.join(fullpath, tags));

  await importToRepoServer(url, fullpath, "Created Standard Layout");

  destroyPath(fullpath);
}

export function createRepoCheckout(url: string) {
  return new Promise<string>((resolve, reject) => {
    const fullpath = newTempDir("svn_checkout_");

    let proc = spawn("svn", ["checkout", url, fullpath], { cwd: tempDir });

    proc.once("exit", exitCode => {
      if (exitCode === 0) {
        resolve(fullpath);
      }
      reject();
    });
  });
}

export function destroyPath(fullPath: string) {
  fullPath = fullPath.replace(/^file\:\/\/\//, "");

  if (!fs.existsSync(fullPath)) {
    return false;
  }

  if (!fs.lstatSync(fullPath).isDirectory()) {
    fs.unlinkSync(fullPath);
    return true;
  }

  const files = fs.readdirSync(fullPath);
  for (let file of files) {
    destroyPath(path.join(fullPath, file));
  }

  //Error in windows with anti-malware
  try {
    fs.rmdirSync(fullPath);
  } catch (error) {
    console.error(error);
  }
  return true;
}

export function destroyAllTempPaths() {
  for (let path of tempDirList) {
    destroyPath(path);
  }
}
