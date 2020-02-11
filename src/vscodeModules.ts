// Only this file is allowed to import VSCode modules
// tslint:disable: import-blacklist

import * as path from "path";
import * as vscode from "vscode";

const appRoot = vscode.env.appRoot;

function loadVSCodeModule(id: string) {
  try {
    return require(`${appRoot}/node_modules.asar/${id}`);
  } catch (ea) {
    // Ignore
  }

  const baseDir = path.dirname(process.execPath);
  try {
    module.paths.unshift(`${baseDir}/node_modules`);
    return require(id);
  } catch (eb) {
    vscode.window.showErrorMessage(
      `Missing dependency, go to "${baseDir}" and run: npm install ${id}`
    );
  }
}

export const iconv = loadVSCodeModule(
  "iconv-lite"
) as typeof import("iconv-lite");
export const jschardet = loadVSCodeModule(
  "jschardet"
) as typeof import("jschardet");
export const keytar = loadVSCodeModule("keytar") as typeof import("keytar");
