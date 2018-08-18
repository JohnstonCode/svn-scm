/* tslint:disable */

import * as cp from "child_process";
import { ChildProcess, SpawnOptions } from "child_process";
import * as fs from "fs";
import * as os from "os";
import { type } from "os";
import * as path from "path";
import { extensions, Uri, window } from "vscode";
import { timeout } from "../util";

const tempDir = os.tmpdir();
const tempDirList: string[] = [];

export function getSvnUrl(uri: Uri) {
  const url = uri.toString();

  return url.replace(/%3A/g, ":");
}

export function spawn(
  command: string,
  args?: string[],
  options?: SpawnOptions
): ChildProcess {
  const proc = cp.spawn(command, args, options);

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
  return new Promise<Uri>((resolve, reject) => {
    const fullpath = newTempDir("svn_server_");
    const dirname = path.basename(fullpath);

    if (fs.existsSync(fullpath)) {
      destroyPath(fullpath);
    }

    const proc = spawn("svnadmin", ["create", dirname], { cwd: tempDir });

    proc.once("exit", exitCode => {
      if (exitCode === 0) {
        resolve(Uri.file(fullpath));
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
    const proc = spawn("svn", ["import", path, url, "-m", message], {
      cwd
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
  return new Promise<Uri>((resolve, reject) => {
    const fullpath = newTempDir("svn_checkout_");

    const proc = spawn("svn", ["checkout", url, fullpath], { cwd: tempDir });

    proc.once("exit", exitCode => {
      if (exitCode === 0) {
        resolve(Uri.file(fullpath));
      }
      reject();
    });
  });
}

export async function destroyPath(fullPath: string) {
  fullPath = fullPath.replace(/^file\:\/\/\//, "");

  if (!fs.existsSync(fullPath)) {
    return false;
  }

  if (!fs.lstatSync(fullPath).isDirectory()) {
    fs.unlinkSync(fullPath);
    return true;
  }

  const files = fs.readdirSync(fullPath);
  for (const file of files) {
    destroyPath(path.join(fullPath, file));
  }

  // Error in windows with anti-malware
  for (let i = 0; i < 3; i++) {
    try {
      fs.rmdirSync(fullPath);
      break;
    } catch (error) {
      await timeout(3000);
      console.error(error);
    }
  }
  return true;
}

export function destroyAllTempPaths() {
  let path;
  while ((path = tempDirList.shift())) {
    destroyPath(path);
  }
}

export function activeExtension() {
  return new Promise<void>((resolve, reject) => {
    const extension = extensions.getExtension("johnstoncode.svn-scm");
    if (!extension) {
      reject();
      return;
    }

    if (!extension.isActive) {
      extension.activate().then(() => resolve(), () => reject());
    } else {
      resolve();
    }
  });
}

const overridesShowInputBox: any[] = [];

export function overrideNextShowInputBox(value: any) {
  overridesShowInputBox.push(value);
}

const originalShowInputBox = window.showInputBox;

window.showInputBox = (options?: any, token?: any) => {
  const next = overridesShowInputBox.shift();
  if (typeof next === "undefined") {
    return originalShowInputBox.call(null, arguments);
  }
  return new Promise((resolve, reject) => {
    resolve(next);
  });
};

const overridesShowQuickPick: any[] = [];

export function overrideNextShowQuickPick(value: any) {
  overridesShowQuickPick.push(value);
}

const originalShowQuickPick = window.showQuickPick;

window.showQuickPick = (
  items: any[] | Thenable<any[]>,
  options?: any,
  token?: any
): Thenable<any | undefined> => {
  let next = overridesShowQuickPick.shift();
  if (typeof next === "undefined") {
    return originalShowQuickPick.call(null, arguments);
  }

  if (typeof next === "number" && Array.isArray(items)) {
    next = items[next];
  }

  return new Promise((resolve, reject) => {
    resolve(next);
  });
};
