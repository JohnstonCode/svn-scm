// Only this file is allowed to import VSCode modules
// tslint:disable: import-blacklist

import * as path from "path";
import * as vscode from "vscode";

const appRoot = vscode.env.appRoot;

// Try load only in VSCode node_modules, like .vsix files (without dev dependencies)
module.paths = [
  path.join(appRoot, "node_modules.asar"),
  path.join(appRoot, "node_modules"), // VSCode < 1.21.0
];

import * as iconv from "iconv-lite";
import * as jschardet from "jschardet";

export { iconv, jschardet };
